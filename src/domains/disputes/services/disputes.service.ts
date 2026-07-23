import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Dispute } from '../entities/dispute.entity';
import { StreamService } from '../../../integration/stream/stream.service';
import { DisputeRepository } from '../repository/dispute.repository';
import { CampaignRepository } from '../../campaigns/repository/campaign.repository';
import { CreateDisputeDto } from '../dtos/create-dispute.dto';
import { ActivateDisputeDto } from '../dtos/activate-dispute.dto';
import { ResolveDisputeDto } from '../dtos/resolve-dispute.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { TimelineService } from '../../campaigns/services/timeline.service';

@Injectable()
export class DisputesService {
  constructor(
    private readonly disputeRepository: DisputeRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly streamService: StreamService,
    private readonly notificationsService: NotificationsService,
    private readonly timelineService: TimelineService,
  ) {}

  /**
   * Generates a Stream user token and upserts the requesting user to Stream
   * with their full profile so they are ready to connect via the frontend SDK.
   */
  async getStreamToken(user: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<{ token: string; apiKey: string }> {
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.id;

    // Ensure this user exists in Stream before the client tries to connect
    await this.streamService.upsertUser({
      id: user.id,
      name: fullName,
      image: user.avatarUrl,
    });

    const token = this.streamService.generateUserToken(user.id);
    const apiKey = this.streamService.getApiKey();
    return { token, apiKey };
  }

  async raiseDispute(userId: string, role: string, dto: CreateDisputeDto): Promise<Dispute> {
    const campaign = await this.campaignRepository.findById(dto.campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    let creatorId: string;
    let brandId: string;

    if (role === 'creator') {
      creatorId = userId;
      brandId = campaign.brandId;
    } else if (role === 'brand') {
      if (campaign.brandId !== userId) {
        throw new ForbiddenException('You do not own this campaign');
      }
      if (!dto.creatorId) {
        throw new BadRequestException('creatorId is required when a brand escalates a dispute');
      }
      creatorId = dto.creatorId;
      brandId = userId;
    } else {
      throw new ForbiddenException('Only creators or brands can raise campaign disputes');
    }

    // Check for existing active dispute to avoid duplicate runs
    const existing = await this.disputeRepository.findOneActive(dto.campaignId, creatorId, brandId);

    if (existing) {
      throw new BadRequestException(
        'An active dispute already exists for this campaign and participants',
      );
    }

    const dispute = await this.disputeRepository.create({
      campaignId: dto.campaignId,
      creatorId,
      brandId,
      status: 'raised',
      reason: dto.reason,
    });

    // Block creator payout if a release exists
    const release = await this.campaignRepository.findReleaseByCampaignAndCreator(
      dto.campaignId,
      creatorId,
    );
    if (release) {
      const actorName = role === 'brand' ? 'Brand' : 'Creator';
      await release.update({
        status: 'disputed',
        errorDetails: `${actorName} raised a dispute: ${dto.reason}`,
      });
    }

    const notifyData = {
      disputeId: dispute.id,
      campaignId: dto.campaignId,
      reason: dto.reason,
    };
    // Counterparty (the dispatcher filters out the actor automatically) ...
    await this.notificationsService.notify({
      type: 'dispute.raised',
      recipientId: [creatorId, brandId],
      actorId: userId,
      data: notifyData,
    });
    // ... and admins, who need to activate the dispute.
    await this.notificationsService.notify({
      type: 'dispute.raised',
      recipientRole: 'admin',
      actorId: userId,
      data: notifyData,
    });

    return dispute;
  }

  async activateDispute(id: string, adminId: string, dto: ActivateDisputeDto): Promise<Dispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Allow re-activation if already under_review — this handles the case where the
    // Stream channel creation previously failed (e.g. channel type didn't exist yet)
    // but the DB was already updated. Stream's GetOrCreateChannel is idempotent.
    const isRetry = dispute.status === 'under_review';

    if (!isRetry && dispute.status !== 'raised') {
      throw new BadRequestException(
        `Dispute cannot be activated. Current status is: ${dispute.status}`,
      );
    }

    const memberIds = [dispute.creatorId, dispute.brandId, adminId];
    if (dto.financeAdminId) {
      memberIds.push(dto.financeAdminId);
    }

    // Ensure all channel participants exist in Stream before creating the channel.
    // Stream's GetOrCreateChannel rejects user IDs that have never been upserted.
    await this.streamService.upsertUsers(memberIds);

    // Create (or ensure) Stream channel — safe to call multiple times.
    await this.streamService.createChannel(
      'dispute',
      `dispute_${dispute.id}`,
      `Dispute - Campaign #${dispute.campaignId}`,
      memberIds,
      adminId,
    );

    if (!isRetry) {
      dispute.status = 'under_review';
      dispute.streamChannelId = `dispute_${dispute.id}`;
      dispute.activatedById = adminId;
      dispute.activatedAt = new Date();
      await dispute.save();

      await this.notificationsService.notify({
        type: 'dispute.activated',
        recipientId: [dispute.creatorId, dispute.brandId],
        actorId: adminId,
        data: { disputeId: dispute.id, campaignId: dispute.campaignId },
        dedupeKey: dispute.id,
      });
    }

    return dispute;
  }

  async resolveDispute(id: string, resolvedById: string, dto: ResolveDisputeDto): Promise<Dispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'under_review') {
      throw new BadRequestException(
        `Dispute cannot be resolved. Current status is: ${dispute.status}`,
      );
    }

    // Freeze Stream channel
    if (dispute.streamChannelId) {
      await this.streamService.freezeChannel('dispute', dispute.streamChannelId);
    }

    dispute.status = 'resolved';
    dispute.escrowAction = dto.action;
    dispute.resolvedAt = new Date();
    dispute.resolvedById = resolvedById;
    dispute.resolutionNotes = dto.resolutionNotes;
    await dispute.save();

    // Process Escrow Decision
    const release = await this.campaignRepository.findReleaseByCampaignAndCreator(
      dispute.campaignId,
      dispute.creatorId,
    );

    if (dto.action === 'release_to_creator') {
      if (release) {
        // Transition status back to pending, preserving original releaseDate
        await release.update({
          status: 'pending',
          errorDetails: `Dispute resolved in favor of Creator. Resolution notes: ${dto.resolutionNotes}`,
        });
      } else {
        // Vetting stage dispute resolved in favor of Creator: create payment release scheduled now + 30 days
        const campaign = await this.campaignRepository.findById(dispute.campaignId);
        const submission = await this.campaignRepository.findSubmissionByCampaignAndCreator(
          dispute.campaignId,
          dispute.creatorId,
        );
        const application = await this.campaignRepository.findApplicationByCampaignAndCreator(
          dispute.campaignId,
          dispute.creatorId,
        );
        if (submission) {
          await submission.update({ status: 'done' });
        }
        if (campaign && application) {
          const releaseDate = new Date();
          releaseDate.setDate(releaseDate.getDate() + 30); // 30 days from now

          const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
            dispute.campaignId,
          );

          await this.campaignRepository.createPaymentRelease({
            campaignId: dispute.campaignId,
            creatorId: dispute.creatorId,
            applicationId: application.id,
            amount: application.feeRequest,
            releaseDate,
            status: 'pending',
            escrowId: campaignPayment?.escrowId ?? null,
            currency: campaign.currency,
            errorDetails: `Dispute resolved in favor of Creator. Resolution notes: ${dto.resolutionNotes}`,
          });
        }
      }
    } else if (dto.action === 'refund_to_brand') {
      if (release) {
        // Creator gets nothing (cancel payout)
        await release.update({
          status: 'cancelled',
          errorDetails: `Dispute resolved in favor of Brand. Refunded. Resolution notes: ${dto.resolutionNotes}`,
        });

        // Queue Brand refund scheduled at the original release date
        const campaign = await this.campaignRepository.findById(dispute.campaignId);
        await this.campaignRepository.createRefund({
          campaignId: dispute.campaignId,
          brandId: dispute.brandId,
          amount: Number(release.amount),
          status: 'pending',
          currency: campaign?.currency ?? 'USD',
          releaseDate: release.releaseDate,
        });
      } else {
        // Vetting stage dispute resolved in favor of Brand: refund queued immediately
        const application = await this.campaignRepository.findApplicationByCampaignAndCreator(
          dispute.campaignId,
          dispute.creatorId,
        );
        const campaign = await this.campaignRepository.findById(dispute.campaignId);
        if (application && campaign) {
          await this.campaignRepository.createRefund({
            campaignId: dispute.campaignId,
            brandId: dispute.brandId,
            amount: Number(application.feeRequest),
            status: 'pending',
            currency: campaign.currency,
            releaseDate: new Date(),
          });
        }
      }
    } else if (dto.action === 'split') {
      if (release) {
        const creatorAmount = Math.floor(Number(release.amount) * 0.5);
        const brandAmount = Number(release.amount) - creatorAmount;

        // Creator gets paid 50%, scheduled at original release date
        await release.update({
          amount: creatorAmount,
          status: 'pending',
          errorDetails: `Dispute resolved via 50/50 split. Creator amount: ${creatorAmount}. Resolution notes: ${dto.resolutionNotes}`,
        });

        // Queue Brand refund for the other 50%, scheduled at original release date
        const campaign = await this.campaignRepository.findById(dispute.campaignId);
        await this.campaignRepository.createRefund({
          campaignId: dispute.campaignId,
          brandId: dispute.brandId,
          amount: brandAmount,
          status: 'pending',
          currency: campaign?.currency ?? 'USD',
          releaseDate: release.releaseDate,
        });
      } else {
        // Vetting stage dispute resolved as split
        const application = await this.campaignRepository.findApplicationByCampaignAndCreator(
          dispute.campaignId,
          dispute.creatorId,
        );
        const campaign = await this.campaignRepository.findById(dispute.campaignId);
        const submission = await this.campaignRepository.findSubmissionByCampaignAndCreator(
          dispute.campaignId,
          dispute.creatorId,
        );
        if (submission) {
          await submission.update({ status: 'done' });
        }
        if (campaign && application) {
          const creatorAmount = Math.floor(Number(application.feeRequest) * 0.5);
          const brandAmount = Number(application.feeRequest) - creatorAmount;

          const releaseDate = new Date();
          releaseDate.setDate(releaseDate.getDate() + 30); // 30 days from now

          const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
            dispute.campaignId,
          );

          // Creator payout release for 50%, scheduled in 30 days
          await this.campaignRepository.createPaymentRelease({
            campaignId: dispute.campaignId,
            creatorId: dispute.creatorId,
            applicationId: application.id,
            amount: creatorAmount,
            releaseDate,
            status: 'pending',
            escrowId: campaignPayment?.escrowId ?? null,
            currency: campaign.currency,
            errorDetails: `Dispute resolved via 50/50 split. Creator amount: ${creatorAmount}. Resolution notes: ${dto.resolutionNotes}`,
          });

          // Brand refund for the other 50%, scheduled immediately
          await this.campaignRepository.createRefund({
            campaignId: dispute.campaignId,
            brandId: dispute.brandId,
            amount: brandAmount,
            status: 'pending',
            currency: campaign.currency,
            releaseDate: new Date(),
          });
        }
      }
    } else if (dto.action === 'extend_days') {
      const application = await this.campaignRepository.findApplicationByCampaignAndCreator(
        dispute.campaignId,
        dispute.creatorId,
      );
      if (application) {
        const extendedTimeline = this.timelineService.extendDays(application.timeline, 3);
        await application.update({ timeline: extendedTimeline });
      }
      if (release) {
        await release.update({
          status: 'pending',
          errorDetails: `Dispute resolved via deadline extension (+3 days). Resolution notes: ${dto.resolutionNotes}`,
        });
      }
    }

    // Both parties learn the outcome (the frozen chat says nothing on its own).
    await this.notificationsService.notify({
      type: 'dispute.resolved',
      recipientId: [dispute.creatorId, dispute.brandId],
      actorId: resolvedById,
      data: {
        disputeId: dispute.id,
        campaignId: dispute.campaignId,
        escrowAction: dto.action,
        resolutionNotes: dto.resolutionNotes,
      },
      dedupeKey: dispute.id,
    });
    // Finance work item: execute the escrow decision in Pandascrow.
    await this.notificationsService.notify({
      type: 'dispute.escrow_action_required',
      recipientRole: 'finance_admin',
      actorId: resolvedById,
      data: { disputeId: dispute.id, campaignId: dispute.campaignId, escrowAction: dto.action },
      dedupeKey: dispute.id,
    });

    return dispute;
  }

  async getDispute(id: string, userId: string, role: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.findByIdWithCampaign(id);

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const isAdmin = ['admin', 'super_admin', 'finance_admin'].includes(role);
    if (!isAdmin && dispute.creatorId !== userId && dispute.brandId !== userId) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return dispute;
  }

  async listDisputes(userId: string, role: string): Promise<Dispute[]> {
    const isAdmin = ['admin', 'super_admin', 'finance_admin'].includes(role);

    if (isAdmin) {
      return this.disputeRepository.findAllWithCampaign();
    }

    if (role === 'creator') {
      return this.disputeRepository.findAllByCreator(userId);
    }

    return this.disputeRepository.findAllByBrand(userId);
  }
}
