import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BroadcastRepository } from '../../notifications/repository/broadcast.repository';
import { NotificationRepository } from '../../notifications/repository/notification.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { DeviceTokenRepository } from '../../notifications/repository/device-token.repository';
import { PushService } from '../../../integration/push/push.service';
import { EmailService } from '../../../integration/email/email.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Broadcast } from '../../notifications/entities/broadcast.entity';
import {
  CreateBroadcastDto,
  UpdateBroadcastDto,
  QueryAdminBroadcastsDto,
} from '../dtos/admin-broadcasts.dto';
import { PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class AdminBroadcastsService {
  private readonly logger = new Logger(AdminBroadcastsService.name);

  constructor(
    private readonly broadcastRepository: BroadcastRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationsService: NotificationsService,
    private readonly deviceTokenRepository: DeviceTokenRepository,
    private readonly pushService: PushService,
    private readonly emailService: EmailService,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
  ) {}

  async createBroadcast(createdById: string, dto: CreateBroadcastDto): Promise<Broadcast> {
    let scheduledAt: Date | null = null;
    if (dto.status === 'scheduled') {
      if (!dto.scheduledAt) {
        throw new BadRequestException('scheduledAt date is required when status is scheduled');
      }
      scheduledAt = new Date(dto.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Invalid scheduledAt date format');
      }
      if (scheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt date must be in the future');
      }
    }

    const broadcast = await this.broadcastRepository.create({
      title: dto.title,
      message: dto.message,
      audience: dto.audience,
      channel: dto.channel,
      status: dto.status,
      scheduledAt,
      createdById,
    });

    if (dto.status === 'sent') {
      // Trigger background dispatch asynchronously
      setImmediate(() => {
        this.dispatchBroadcast(broadcast.id).catch((err) => {
          this.logger.error(`Error in async broadcast dispatch: ${(err as Error).message}`);
        });
      });
    }

    return (await this.broadcastRepository.findById(broadcast.id))!;
  }

  async getBroadcastsList(query: QueryAdminBroadcastsDto): Promise<PaginatedResult<Broadcast>> {
    return this.broadcastRepository.findAll({
      page: query.page || 1,
      limit: query.limit || 10,
      tab: query.tab,
      audience: query.audience,
      q: query.q,
    });
  }

  async getBroadcastById(id: string): Promise<Broadcast> {
    const broadcast = await this.broadcastRepository.findById(id);
    if (!broadcast) {
      throw new NotFoundException('Broadcast notification not found');
    }
    return broadcast;
  }

  async updateBroadcast(id: string, dto: UpdateBroadcastDto): Promise<Broadcast> {
    const broadcast = await this.getBroadcastById(id);

    if (broadcast.status === 'sent') {
      throw new ForbiddenException('Cannot modify a broadcast that has already been sent');
    }

    const updates: Partial<Broadcast> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.message !== undefined) updates.message = dto.message;
    if (dto.audience !== undefined) updates.audience = dto.audience;
    if (dto.channel !== undefined) updates.channel = dto.channel;
    if (dto.status !== undefined) updates.status = dto.status;

    if (
      dto.status === 'scheduled' ||
      (dto.scheduledAt !== undefined && broadcast.status === 'scheduled')
    ) {
      const scheduledStr =
        dto.scheduledAt || (broadcast.scheduledAt ? broadcast.scheduledAt.toISOString() : null);
      if (!scheduledStr) {
        throw new BadRequestException('scheduledAt date is required when status is scheduled');
      }
      const scheduledDate = new Date(scheduledStr);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt date must be in the future');
      }
      updates.scheduledAt = scheduledDate;
    }

    await this.broadcastRepository.update(id, updates);
    const updated = (await this.broadcastRepository.findById(id))!;

    if (dto.status === 'sent') {
      setImmediate(() => {
        this.dispatchBroadcast(updated.id).catch((err) => {
          this.logger.error(`Error in async broadcast dispatch: ${(err as Error).message}`);
        });
      });
    }

    return updated;
  }

  async deleteBroadcast(id: string): Promise<{ message: string }> {
    const broadcast = await this.getBroadcastById(id);
    await this.broadcastRepository.delete(broadcast.id);
    return { message: 'Broadcast deleted successfully' };
  }

  /**
   * Background runner resolving recipients and sending In-App notifications / Emails
   */
  async dispatchBroadcast(broadcastId: string): Promise<void> {
    const broadcast = await this.broadcastRepository.findById(broadcastId);
    if (!broadcast) return;

    this.logger.log(`Starting dispatch for broadcast ID: ${broadcast.id} (${broadcast.title})`);

    let roleNames: string[] = [];
    if (broadcast.audience === 'creators') {
      roleNames = ['creator'];
    } else if (broadcast.audience === 'brands') {
      roleNames = ['brand'];
    } else {
      roleNames = ['creator', 'brand'];
    }

    const roles = await this.roleModel.findAll({
      where: { name: { [Op.in]: roleNames } },
    });
    const roleIds = roles.map((r) => r.id);

    const targetUsers = await this.userModel.findAll({
      where: {
        roleId: { [Op.in]: roleIds },
        isActive: true,
      },
      attributes: ['id', 'email', 'firstName', 'lastName'],
    });

    const totalRecipients = targetUsers.length;
    this.logger.log(`Targeted ${totalRecipients} active users for broadcast ${broadcast.id}`);

    await broadcast.update({
      totalRecipients,
      status: 'sent',
      sentAt: new Date(),
    });

    if (broadcast.channel === 'in_app' || broadcast.channel === 'both') {
      const notificationsData = targetUsers.map((u) => ({
        userId: u.id,
        actorId: broadcast.createdById,
        type: 'broadcast.announcement',
        category: 'broadcast',
        priority: 'medium',
        title: broadcast.title,
        body: broadcast.message,
        data: { broadcastId: broadcast.id },
      }));

      const chunkSize = 100;
      for (let i = 0; i < notificationsData.length; i += chunkSize) {
        const chunk = notificationsData.slice(i, i + chunkSize);
        await Promise.all(chunk.map((nData) => this.notificationRepository.create(nData)));
      }

      // Product rule: "in_app" always means in-app + push together. Push is
      // best-effort — failures never fail the broadcast; dead tokens pruned.
      try {
        const tokens = await this.deviceTokenRepository.findTokensForUsers(
          targetUsers.map((u) => u.id),
        );
        if (tokens.length > 0) {
          const result = await this.pushService.sendToTokens(tokens, {
            title: broadcast.title,
            body: broadcast.message,
            data: { type: 'broadcast.announcement', actionUrl: '' },
          });
          if (result.invalidTokens.length > 0) {
            await this.deviceTokenRepository.removeTokens(result.invalidTokens);
          }
          this.logger.log(
            `Broadcast ${broadcast.id} push: ${result.sent} sent, ${result.failed} failed.`,
          );
        }
      } catch (err) {
        this.logger.error(`Broadcast ${broadcast.id} push leg failed: ${(err as Error).message}`);
      }
    }

    // Social-login users carry synthetic placeholder addresses
    // (tiktok_<id>@trendupp.tiktok, ...) that bounce — skip the email leg for
    // them, same as the notification dispatcher does.
    const syntheticEmail = /@trendupp\.(tiktok|instagram|facebook|apple)$/i;

    if (broadcast.channel === 'email' || broadcast.channel === 'both') {
      for (const u of targetUsers) {
        if (u.email && !syntheticEmail.test(u.email)) {
          try {
            await this.emailService.send({
              to: u.email,
              subject: broadcast.title,
              template: 'broadcast',
              data: {
                firstName: u.firstName,
                title: broadcast.title,
                message: broadcast.message,
              },
            });
          } catch (err) {
            this.logger.error(
              `Failed sending broadcast email to ${u.email}: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    this.logger.log(`Completed dispatch for broadcast ID: ${broadcast.id}`);

    // Confirmation to the sending admin's inbox.
    await this.notificationsService.notify({
      type: 'broadcast.sent',
      recipientId: broadcast.createdById,
      data: {
        broadcastId: broadcast.id,
        title: broadcast.title,
        totalRecipients,
      },
      dedupeKey: broadcast.id,
    });
  }

  /**
   * Dispatches every scheduled broadcast whose time has come. Invoked by the
   * BullMQ repeatable job (BroadcastSchedulerProcessor) every minute — the
   * queue guarantees exactly one worker per tick across the PM2 cluster, and
   * claimScheduled() guards each broadcast against racing a manual send.
   */
  async dispatchDueScheduled(): Promise<number> {
    const due = await this.broadcastRepository.findPendingScheduled();
    let dispatched = 0;

    for (const broadcast of due) {
      const claimed = await this.broadcastRepository.claimScheduled(broadcast.id);
      if (!claimed) continue; // sent manually (or by a concurrent tick) in the meantime

      try {
        await this.dispatchBroadcast(broadcast.id);
        dispatched += 1;
      } catch (err) {
        this.logger.error(
          `Scheduled broadcast ${broadcast.id} failed to dispatch: ${(err as Error).message}`,
        );
        await this.broadcastRepository.update(broadcast.id, { status: 'failed' });
      }
    }

    if (dispatched > 0) {
      this.logger.log(`Dispatched ${dispatched} scheduled broadcast(s).`);
    }
    return dispatched;
  }
}
