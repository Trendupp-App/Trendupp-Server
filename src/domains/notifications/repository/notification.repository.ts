import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes } from 'sequelize';
import { Notification } from '../entities/notification.entity';
import { User } from '../../users/entities/user.entity';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

/**
 * Lean actor shape included in feed responses — enough to render a
 * name/avatar next to each notification (mirrors disputes' AUDIT_USER_ATTRS).
 */
const ACTOR_ATTRS: (keyof User)[] = ['id', 'firstName', 'lastName', 'avatarUrl'];

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
  ) {}

  async create(data: Partial<Attributes<Notification>>): Promise<Notification> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.notificationModel as any).create(data) as Promise<Notification>;
  }

  async findForUser(
    userId: string,
    options: { page: number; limit: number; unreadOnly?: boolean; category?: string },
  ): Promise<PaginatedResult<Notification>> {
    const where: Record<string, unknown> = { userId };
    if (options.unreadOnly) {
      where.readAt = null;
    }
    if (options.category) {
      where.category = options.category;
    }

    return paginate(
      this.notificationModel,
      {
        where,
        include: [{ association: 'actor', attributes: ACTOR_ATTRS }],
        order: [['createdAt', 'DESC']],
      },
      { page: options.page, limit: options.limit },
    );
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const notification = await this.notificationModel.findOne({ where: { id, userId } });
    if (!notification) {
      return null;
    }
    if (!notification.readAt) {
      await notification.update({ readAt: new Date(), seenAt: notification.seenAt ?? new Date() });
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<number> {
    const now = new Date();
    const [affected] = await this.notificationModel.update(
      { readAt: now },
      { where: { userId, readAt: null } },
    );
    return affected;
  }

  /** Zeroes the badge without marking items read (tray opened). */
  async markAllSeen(userId: string): Promise<number> {
    const [affected] = await this.notificationModel.update(
      { seenAt: new Date() },
      { where: { userId, seenAt: null } },
    );
    return affected;
  }
}
