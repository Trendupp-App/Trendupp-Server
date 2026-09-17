import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../entities/campaign.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class CampaignDeadlineReminderScheduler {
  private readonly logger = new Logger(CampaignDeadlineReminderScheduler.name);

  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(ContentSubmission)
    private readonly submissionModel: typeof ContentSubmission,
    @InjectModel(Dispute)
    private readonly disputeModel: typeof Dispute,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processDeadlineReminders(): Promise<void> {
    this.logger.log('Running campaign deadline & reminder scan...');

    try {
      const now = new Date();
      await this.processUnfundedCampaignReminders(now);
      await this.processApplicationWindowReminders(now);
      await this.processSubmissionAndReviewReminders(now);
      await this.processStaleDisputeReminders(now);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing deadline reminders: ${message}`);
    }
  }

  /** Reminds brands on day 2, 5, 7 if a campaign remains unfunded/draft. */
  private async processUnfundedCampaignReminders(now: Date): Promise<void> {
    const unfunded = await this.campaignModel.findAll({
      where: {
        paymentStatus: 'unpaid',
      } as unknown as Record<string, unknown>,
    });

    for (const campaign of unfunded) {
      if (campaign.status === 'completed' || campaign.status === 'cancelled') continue;

      const ageHours = (now.getTime() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60);
      const ageDays = ageHours / 24;

      const reminderDays = [2, 5, 7];
      for (const targetDay of reminderDays) {
        if (ageDays >= targetDay && ageDays < targetDay + 0.1) {
          await this.notificationsService.notify({
            type: 'campaign.unfunded_reminder',
            recipientId: campaign.brandId,
            data: { campaignId: campaign.id, campaignTitle: campaign.title },
            dedupeKey: `unfunded-reminder:${campaign.id}:day-${targetDay}`,
          });
        }
      }
    }
  }

  /** Reminds creators 24h before campaign application window closes. */
  private async processApplicationWindowReminders(now: Date): Promise<void> {
    const activeCampaigns = await this.campaignModel.findAll({
      where: { status: 'active' } as unknown as Record<string, unknown>,
    });

    for (const campaign of activeCampaigns) {
      const timeline = (campaign.timeline as Record<string, any>) || {};
      const stage1 = timeline.stage1_application_window as Record<string, unknown> | undefined;
      const endedDateRaw = (stage1?.endedDate as string | undefined) || null;
      if (!endedDateRaw) continue;

      const endDate = new Date(String(endedDateRaw));
      const hoursRemaining = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Fires when remaining time is between 23h and 25h
      if (hoursRemaining <= 25 && hoursRemaining >= 23) {
        await this.notificationsService.notify({
          type: 'application.window_closing_soon',
          recipientId: campaign.brandId, // or broadcast/interested creators
          data: { campaignId: campaign.id, campaignTitle: campaign.title },
          dedupeKey: `app-window-closing:${campaign.id}`,
        });
      }
    }
  }

  /** Scans creator applications for submission/review 24h/48h reminders. */
  private async processSubmissionAndReviewReminders(now: Date): Promise<void> {
    const acceptedApps = await this.applicationModel.findAll({
      where: { status: 'accepted' } as unknown as Record<string, unknown>,
    });

    for (const app of acceptedApps) {
      const submission = await this.submissionModel.findOne({
        where: { applicationId: app.id },
      });

      const campaign = await this.campaignModel.findByPk(app.campaignId).catch(() => null);
      if (!campaign) continue;

      const timeline = (app.timeline as Record<string, any>) || {};
      const stage2 = timeline.stage2_content_submission as Record<string, any> | undefined;
      const stage3 = timeline.stage3_brand_review as Record<string, any> | undefined;

      // 1. Content submission due in 24h
      if (stage2?.endedDate && (!submission || submission.status === 'pending')) {
        const hoursRemaining =
          (new Date(String(stage2.endedDate)).getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursRemaining <= 25 && hoursRemaining >= 23) {
          await this.notificationsService.notify({
            type: 'submission.deadline_approaching',
            recipientId: app.creatorId,
            data: { campaignId: campaign.id, campaignTitle: campaign.title },
            dedupeKey: `sub-deadline:${app.id}`,
          });
        }
      }

      // 2. Brand review due in 24h
      if (stage3?.endedDate && submission && submission.status === 'submitted') {
        const hoursRemaining =
          (new Date(String(stage3.endedDate)).getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursRemaining <= 25 && hoursRemaining >= 23) {
          await this.notificationsService.notify({
            type: 'submission.review_deadline_approaching',
            recipientId: campaign.brandId,
            data: {
              campaignId: campaign.id,
              campaignTitle: campaign.title,
              creatorName: 'The creator',
            },
            dedupeKey: `review-deadline:${submission.id}`,
          });
        }
      }

      // 3. Live link missing after approval (fires at 24h, then every 48h)
      if (submission && submission.status === 'approved' && !submission.liveLink?.link) {
        const approvedAt = submission.updatedAt || submission.createdAt;
        const hoursSinceApproval =
          (now.getTime() - new Date(approvedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceApproval >= 24) {
          const intervalIndex = Math.floor((hoursSinceApproval - 24) / 48);
          await this.notificationsService.notify({
            type: 'submission.live_link_needed',
            recipientId: app.creatorId,
            data: { campaignId: campaign.id, campaignTitle: campaign.title },
            dedupeKey: `live-link-needed:${submission.id}:${intervalIndex}`,
          });
        }
      }
    }
  }

  /** Alerts admins if a dispute has been open for 3+ days without action. */
  private async processStaleDisputeReminders(now: Date): Promise<void> {
    const activeDisputes = await this.disputeModel.findAll({
      where: { status: 'under_review' } as unknown as Record<string, unknown>,
    });

    for (const dispute of activeDisputes) {
      const activatedAt = dispute.activatedAt || dispute.createdAt;
      const daysOpen = Math.floor(
        (now.getTime() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysOpen >= 3) {
        const campaign = await this.campaignModel.findByPk(dispute.campaignId).catch(() => null);
        await this.notificationsService.notify({
          type: 'admin.dispute_open_too_long',
          recipientRole: ['super_admin', 'support_agent', 'moderator'],
          data: {
            disputeId: dispute.id,
            campaignId: dispute.campaignId,
            campaignTitle: campaign?.title ?? 'Campaign',
            daysOpen,
          },
          dedupeKey: `dispute-stale:${dispute.id}:day-${daysOpen}`,
        });
      }
    }
  }
}
