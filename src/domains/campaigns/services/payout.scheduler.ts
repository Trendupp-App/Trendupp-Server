import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignRepository } from '../repository/campaign.repository';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayoutScheduler {
  private readonly logger = new Logger(PayoutScheduler.name);
  private readonly walletId: number;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly usersService: UsersService,
    private readonly pandascrowService: PandascrowService,
    private readonly configService: ConfigService,
  ) {
    this.walletId = this.configService.get<number>('pandascrow.walletId') || 1;
  }

  /**
   * Cron job that checks for creator payouts that are due (scheduled release date has passed).
   * Runs daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processPendingPayouts() {
    this.logger.log('Starting daily payout check for creators...');
    const now = new Date();
    const pendingReleases = await this.campaignRepository.findDuePendingReleases(now);

    if (pendingReleases.length === 0) {
      this.logger.log('No due pending payouts found.');

      // I should send email after getting clarity from stakeholders
      return;
    }

    this.logger.log(`Found ${pendingReleases.length} due payouts to process.`);

    for (const release of pendingReleases) {
      try {
        // Fetch creator details
        const creator = await this.usersService.findOne(release.creatorId);
        if (!creator) {
          throw new Error('Creator profile not found');
        }

        if (!creator.bankAccountNumber || !creator.bank?.code) {
          throw new Error('Creator payout bank details are missing or incomplete');
        }

        // Generate unique reference (idempotency key) for this release payout
        const payoutRef = `payout_${release.id.replace(/-/g, '')}`;

        this.logger.log(
          `Processing payout for release ID: ${release.id}, Creator: ${creator.email}`,
        );

        // Trigger payout request from Trendupp's Pandascrow wallet to creator's bank account
        const success = await this.pandascrowService.requestPayout({
          payoutRef,
          walletId: this.walletId,
          amount: release.amount,
          currency: 'NGN', // Default to NGN as per onboarding spec
          bankCode: creator.bank.code,
          accountNumber: creator.bankAccountNumber,
          accountName: creator.bankAccountName || `${creator.firstName} ${creator.lastName}`,
        });

        if (success) {
          await release.update({
            status: 'released',
            errorDetails: null,
          });
          this.logger.log(`Successfully completed payout for release ID: ${release.id}`);

          // Check if the campaign can be completed
          await this.checkAndCompleteCampaign(release.campaignId);
        } else {
          throw new Error('Pandascrow payout failed without explicit error');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Payout failed for release ID ${release.id}: ${message}`);
        await release.update({
          status: 'failed',
          errorDetails: message,
        });
      }
    }
  }

  /**
   * Checks if all payment releases and submissions for this campaign are done.
   * If yes, updates campaign status to 'completed'.
   */
  private async checkAndCompleteCampaign(campaignId: string): Promise<void> {
    try {
      const pendingCount = await this.campaignRepository.countPendingReleases(campaignId);
      if (pendingCount > 0) {
        return;
      }

      const activeSubmissions = await this.campaignRepository.countActiveSubmissions(campaignId);
      if (activeSubmissions > 0) {
        return;
      }

      const campaign = await this.campaignRepository.findById(campaignId);
      if (campaign && campaign.status !== 'completed') {
        await campaign.update({ status: 'completed' });
        this.logger.log(`Campaign ID: ${campaignId} has been successfully completed.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error checking completion status for campaign ${campaignId}: ${message}`);
    }
  }
}
