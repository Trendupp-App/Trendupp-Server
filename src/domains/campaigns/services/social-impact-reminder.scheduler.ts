import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../entities/campaign.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class SocialImpactReminderScheduler {
  private readonly logger = new Logger(SocialImpactReminderScheduler.name);

  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(ContentSubmission)
    private readonly submissionModel: typeof ContentSubmission,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every hour to check Active Social Impact campaigns.
   * 1. Auto-completes campaigns whose endDate has passed (now >= endDate).
   * 2. Sends Reminder 1 and Reminder 2 push/in-app notifications to creators who participated but have not submitted live content links.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processSocialImpactRemindersAndExpirations(): Promise<void> {
    this.logger.log('Running Social Impact reminder & expiration check...');

    try {
      const now = new Date();

      const activeCampaigns = await this.campaignModel.findAll({
        where: {
          type: 'social_impact',
          status: 'active',
        } as unknown as Record<string, unknown>,
      });

      for (const campaign of activeCampaigns) {
        const timeline = (campaign.timeline as Record<string, any>) || {};
        const stage1 = timeline.stage1_application_window as Record<string, any> | undefined;
        const endDateRaw = timeline.endDate || stage1?.endedDate;
        if (!endDateRaw) continue;

        const endDateStr = String(endDateRaw);
        const endDate = new Date(endDateStr);

        // 1. Auto-complete if end date has passed
        if (now >= endDate) {
          this.logger.log(
            `Social Impact Campaign ${campaign.id} (${campaign.title}) end date ${endDate.toISOString()} reached. Updating status to 'completed'.`,
          );
          await campaign.update({ status: 'completed' });
          continue;
        }

        // 2. Reminder Notification Timing Calculations
        const publishedAtRaw = timeline.publishedAt || campaign.approvedAt || campaign.createdAt;
        const publishedAtStr = publishedAtRaw ? String(publishedAtRaw) : null;
        const publishedAt = publishedAtStr ? new Date(publishedAtStr) : now;

        const durationHours = (endDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
        const msRemaining = endDate.getTime() - now.getTime();
        const hoursRemaining = msRemaining / (1000 * 60 * 60);

        let triggerReminder1 = false;
        let triggerReminder2 = false;

        if (durationHours < 24) {
          // Less than 24h duration: Reminder 1 at 2 hours before end
          if (hoursRemaining <= 2.2 && hoursRemaining >= 1.0) {
            triggerReminder1 = true;
          }
        } else if (durationHours <= 72) {
          // 1 to 3 days (24h to 72h): R1 at 12h, R2 at 2h
          if (hoursRemaining <= 12.2 && hoursRemaining >= 11.0) {
            triggerReminder1 = true;
          } else if (hoursRemaining <= 2.2 && hoursRemaining >= 1.0) {
            triggerReminder2 = true;
          }
        } else if (durationHours <= 168) {
          // 4 to 7 days (96h to 168h): R1 at 24h, R2 at 2h
          if (hoursRemaining <= 24.2 && hoursRemaining >= 23.0) {
            triggerReminder1 = true;
          } else if (hoursRemaining <= 2.2 && hoursRemaining >= 1.0) {
            triggerReminder2 = true;
          }
        } else {
          // More than 7 days (> 168h): R1 at 48h, R2 at 2h
          if (hoursRemaining <= 48.2 && hoursRemaining >= 47.0) {
            triggerReminder1 = true;
          } else if (hoursRemaining <= 2.2 && hoursRemaining >= 1.0) {
            triggerReminder2 = true;
          }
        }

        if (!triggerReminder1 && !triggerReminder2) continue;

        // Find participants who have NOT submitted live link yet
        const applications = await this.applicationModel.findAll({
          where: { campaignId: campaign.id },
        });

        for (const app of applications) {
          const submission = await this.submissionModel.findOne({
            where: { applicationId: app.id },
          });

          // If submission exists and liveLink is provided, skip (no reminders after submission)
          if (submission && submission.liveLink?.link) {
            continue;
          }

          const reminderType = triggerReminder1 ? 'Reminder 1' : 'Reminder 2';
          this.logger.log(
            `Dispatching ${reminderType} for creator ${app.creatorId} on Social Impact Campaign ${campaign.title}`,
          );

          await this.notificationsService.notify({
            type: 'social_impact.reminder',
            recipientId: app.creatorId,
            data: {
              campaignId: campaign.id,
              campaignTitle: campaign.title,
              hoursRemaining: Math.round(hoursRemaining),
              reminderType,
            },
          });
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Social Impact reminder scheduler: ${msg}`);
    }
  }
}
