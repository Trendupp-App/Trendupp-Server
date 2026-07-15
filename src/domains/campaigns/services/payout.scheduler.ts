import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignRepository } from '../repository/campaign.repository';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class PayoutScheduler {
  private readonly logger = new Logger(PayoutScheduler.name);
  private readonly walletId: number;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly usersService: UsersService,
    private readonly pandascrowService: PandascrowService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.walletId = this.configService.get<number>('pandascrow.walletId') || 1;
  }

  /**
   * Cron job that checks for creator payouts that are due (scheduled release date has passed).
   * Runs daily at midnight. EVERY_5_SECONDS
   */
  // @Cron(CronExpression.EVERY_5_SECONDS)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processPendingPayouts() {
    this.logger.log('Starting daily payout check for creators...');
    const now = new Date();
    const pendingReleases = await this.campaignRepository.findDuePendingReleases(now);

    console.log('Pending releases:', pendingReleases);
    if (pendingReleases.length === 0) {
      this.logger.log('No due pending payouts found.');
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

        // Generate unique reference (idempotency key) for this release payout.
        // Must be <= 25 characters (limit enforced by Pandascrow /bank/transfers).
        const payoutRef = `pay_${release.id.replace(/-/g, '').substring(0, 20)}`;

        this.logger.log(
          `Processing payout for release ID: ${release.id}, Creator: ${creator.email}`,
        );

        // Guard: only proceed with bank transfer if the Pandascrow escrow has been released.
        // The finance admin releases the escrow via the Pandascrow dashboard, which triggers
        // the escrow.completed webhook → updates Payment.escrowStatus → unblocks this release.
        const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
          release.campaignId,
        );
        if (campaignPayment?.escrowStatus !== 'completed') {
          this.logger.warn(
            `Escrow not yet released for campaign ${release.campaignId} ` +
              `(release ID: ${release.id}). ` +
              `Escrow status: ${campaignPayment?.escrowStatus ?? 'unknown'}. ` +
              `Parking as escrow_pending — will retry after escrow.completed webhook.`,
          );
          await release.update({ status: 'escrow_pending', errorDetails: null });

          // Work item for finance admins: release the escrow in Pandascrow.
          // dedupeKey: the cron fires daily on every PM2 instance — one alert
          // per release, not one per instance per day.
          await this.notificationsService.notify({
            type: 'payout.escrow_pending',
            recipientRole: 'finance_admin',
            data: {
              campaignId: release.campaignId,
              releaseId: release.id,
              amount: Number(release.amount),
            },
            dedupeKey: `${release.id}:escrow_pending`,
          });
          continue;
        }

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

          const campaign = await this.campaignRepository.findById(release.campaignId);
          await this.notificationsService.notify({
            type: 'payout.released',
            recipientId: release.creatorId,
            data: {
              campaignId: release.campaignId,
              campaignTitle: campaign?.title ?? 'your campaign',
              releaseId: release.id,
              amount: Number(release.amount),
            },
            dedupeKey: release.id,
          });

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

        const campaign = await this.campaignRepository
          .findById(release.campaignId)
          .catch(() => null);
        const failureData = {
          campaignId: release.campaignId,
          campaignTitle: campaign?.title ?? 'your campaign',
          releaseId: release.id,
          amount: Number(release.amount),
          reason: message,
        };
        // Creator alert + finance-admin work item. Failed releases are retried
        // on subsequent cron runs, so dedupe on the release id to notify once.
        await this.notificationsService.notify({
          type: 'payout.failed',
          recipientId: release.creatorId,
          data: failureData,
          dedupeKey: `${release.id}:failed`,
        });
        await this.notificationsService.notify({
          type: 'payout.failed',
          recipientRole: 'finance_admin',
          data: failureData,
          dedupeKey: `${release.id}:failed:finance`,
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

        await this.notificationsService.notify({
          type: 'campaign.completed',
          recipientId: campaign.brandId,
          data: { campaignId, campaignTitle: campaign.title },
          dedupeKey: `${campaignId}:completed`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error checking completion status for campaign ${campaignId}: ${message}`);
    }
  }
}
