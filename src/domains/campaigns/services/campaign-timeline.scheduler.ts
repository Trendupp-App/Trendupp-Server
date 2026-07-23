import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignRepository } from '../repository/campaign.repository';
import { TimelineService } from './timeline.service';

@Injectable()
export class CampaignTimelineScheduler {
  private readonly logger = new Logger(CampaignTimelineScheduler.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly timelineService: TimelineService,
  ) {}

  /**
   * Cron job that checks live campaigns and transitions them to 'reviewing_applicant'
   * once the 48-hour application SLA window has passed.
   * Runs daily at 3:00 AM (and every hour in production for accuracy).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processApplicationWindowExpirations(): Promise<void> {
    this.logger.log('Checking for campaigns exceeding the 48-hour application window...');
    try {
      const liveResult = await this.campaignRepository.findLiveCampaigns(1, 500);
      const liveCampaigns = liveResult.data || [];
      const now = new Date();

      for (const campaign of liveCampaigns) {
        const approvedAt = campaign.approvedAt
          ? new Date(campaign.approvedAt)
          : campaign.createdAt
            ? new Date(campaign.createdAt)
            : null;
        if (!approvedAt) continue;

        const hoursElapsed = (now.getTime() - approvedAt.getTime()) / (1000 * 60 * 60);

        if (hoursElapsed >= 48) {
          this.logger.log(
            `Campaign ${campaign.id} reached 48h application limit (${hoursElapsed.toFixed(1)}h elapsed). ` +
              `Updating status to 'reviewing_applicant'.`,
          );

          const updatedTimeline = this.timelineService.completeApplicationWindow(
            campaign.timeline,
            now,
          );

          await campaign.update({
            status: 'reviewing_applicant',
            timeline: updatedTimeline,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing campaign application window expirations: ${message}`);
    }
  }
}
