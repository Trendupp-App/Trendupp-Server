import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../entities/campaign.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';

/**
 * Reminder tiers from the PM spec — chosen by TOTAL campaign duration
 * (published date → end date), fired by time REMAINING:
 *
 *   duration < 24h   → R1 at T-2h                 (no final reminder)
 *   1–3 days         → R1 at T-12h, final at T-2h
 *   4–7 days         → R1 at T-24h, final at T-2h
 *   > 7 days         → R1 at T-48h, final at T-2h
 *
 * The cron runs hourly, so each trigger uses a ~1.2h-wide window; the
 * dedupeKey (not the window) is what guarantees at-most-once per creator.
 */
const FINAL_REMINDER_HOURS = 2;

function firstReminderHours(durationHours: number): number {
  if (durationHours < 24) return 2;
  if (durationHours <= 72) return 12;
  if (durationHours <= 168) return 24;
  return 48;
}

/** "48 hours" / "2 hours" — the human string rendered into the body copy. */
function formatRemaining(hours: number): string {
  const rounded = Math.max(1, Math.round(hours));
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}

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
   * Hourly pass over Active Social Impact campaigns:
   * 1. Auto-completes campaigns whose end date has passed and tells the
   *    admin team ("Campaign ended").
   * 2. Sends the first/final reminders to creators who participated but have
   *    not submitted a live link yet.
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
        const endDateRaw =
          (timeline.endDate as string | undefined) || (stage1?.endedDate as string | undefined);
        if (!endDateRaw) continue;

        const endDate = new Date(String(endDateRaw));

        // 1. Deadline reached → complete + notify the admin team.
        if (now >= endDate) {
          this.logger.log(
            `Social Impact Campaign ${campaign.id} (${campaign.title}) end date ${endDate.toISOString()} reached. Updating status to 'completed'.`,
          );
          await campaign.update({ status: 'completed' });

          await this.notificationsService.notify({
            type: 'social_impact.admin_ended',
            recipientRole: ['owner', 'super_admin', 'moderator'],
            data: { campaignId: campaign.id, campaignTitle: campaign.title },
            dedupeKey: `si-ended:${campaign.id}`,
          });
          continue;
        }

        // 2. Which reminder (if any) is due this tick?
        const publishedAtRaw =
          (timeline.publishedAt as string | undefined) || campaign.approvedAt || campaign.createdAt;
        const publishedAt = publishedAtRaw ? new Date(String(publishedAtRaw)) : now;

        const durationHours = (endDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
        const hoursRemaining = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        const r1Hours = firstReminderHours(durationHours);
        const hasFinal = durationHours >= 24;

        // Window: from the trigger point until 1h before it, matching the
        // hourly cadence. The dedupeKey below makes re-entry harmless.
        const inWindow = (target: number) =>
          hoursRemaining <= target + 0.2 && hoursRemaining >= target - 1.0;

        let reminder: 'first' | 'final' | null = null;
        if (hasFinal && inWindow(FINAL_REMINDER_HOURS)) reminder = 'final';
        else if (inWindow(r1Hours)) reminder = r1Hours === FINAL_REMINDER_HOURS ? 'final' : 'first';
        // (<24h campaigns get ONE reminder at T-2h; the spec labels it
        // Reminder 1, but the "Only 2 hours remain" copy is the accurate one.)

        if (!reminder) continue;

        // 3. Participants who have not submitted a live link.
        const applications = await this.applicationModel.findAll({
          where: { campaignId: campaign.id },
        });

        for (const app of applications) {
          // Participants the admin rejected are out of the campaign — no nags.
          if ((app.status || '').toLowerCase() === 'rejected') continue;

          const submission = await this.submissionModel.findOne({
            where: { applicationId: app.id },
          });
          if (submission && submission.liveLink?.link) continue;

          this.logger.log(
            `Dispatching ${reminder} reminder for creator ${app.creatorId} on Social Impact Campaign ${campaign.title}`,
          );

          if (reminder === 'final') {
            await this.notificationsService.notify({
              type: 'social_impact.final_reminder',
              recipientId: app.creatorId,
              data: { campaignId: campaign.id, campaignTitle: campaign.title },
              dedupeKey: `si-reminder-final:${campaign.id}:${app.creatorId}`,
            });
          } else {
            await this.notificationsService.notify({
              type: 'social_impact.reminder',
              recipientId: app.creatorId,
              data: {
                campaignId: campaign.id,
                campaignTitle: campaign.title,
                remainingTime: formatRemaining(hoursRemaining),
                tokenReward: campaign.tokenReward ?? 0,
              },
              dedupeKey: `si-reminder-1:${campaign.id}:${app.creatorId}`,
            });
          }
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in Social Impact reminder scheduler: ${msg}`);
    }
  }
}
