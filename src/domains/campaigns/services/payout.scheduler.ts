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
    if (pendingReleases.length > 0) {
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
                currency: release.currency,
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
            currency: release.currency || 'USD',
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
                currency: release.currency,
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

          const campaign = await Promise.resolve(
            this.campaignRepository.findById(release.campaignId),
          ).catch(() => null);
          const failureData = {
            campaignId: release.campaignId,
            campaignTitle: campaign?.title ?? 'your campaign',
            releaseId: release.id,
            amount: Number(release.amount),
            currency: release.currency,
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
    } else {
      this.logger.log('No due pending payouts found.');
    }

    // Scan for any ended campaigns with remaining budget to refund
    await this.scanAndQueueRefunds();

    // Process brand refund transfers from wallet
    await this.processPendingRefunds();
  }

  async scanAndQueueRefunds(): Promise<void> {
    this.logger.log('Scanning for ended campaigns with remaining budget to refund...');
    try {
      const endedCampaigns = await this.campaignRepository.findEndedCampaignsWithoutRefund();
      for (const campaign of endedCampaigns) {
        const totalReleasesAmount = await this.campaignRepository.sumPaymentReleases(campaign.id);
        const refundAmount = campaign.totalBudget - totalReleasesAmount;
        if (refundAmount > 0) {
          this.logger.log(
            `Queueing refund of ${refundAmount} for campaign ${campaign.id} ` +
              `(budget: ${campaign.totalBudget}, payouts: ${totalReleasesAmount})`,
          );
          await this.campaignRepository.createRefund({
            campaignId: campaign.id,
            brandId: campaign.brandId,
            amount: refundAmount,
            status: 'pending',
            currency: campaign.currency,
          });
        } else {
          // Record a completed refund of 0 to mark this ended campaign as fully processed
          await this.campaignRepository.createRefund({
            campaignId: campaign.id,
            brandId: campaign.brandId,
            amount: 0,
            status: 'completed',
            currency: campaign.currency,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error scanning and queueing refunds: ${message}`);
    }
  }

  async processPendingRefunds(): Promise<void> {
    this.logger.log('Starting brand refunds processing and transfers...');
    try {
      const pendingRefunds = await this.campaignRepository.findPendingRefunds();
      if (pendingRefunds.length === 0) {
        this.logger.log('No pending refunds found.');
        return;
      }

      this.logger.log(`Found ${pendingRefunds.length} pending refunds to process.`);

      for (const refund of pendingRefunds) {
        try {
          const brand = await this.usersService.findOne(refund.brandId);
          if (!brand) {
            throw new Error('Brand user profile not found');
          }

          if (!brand.bankAccountNumber || !brand.bank?.code) {
            this.logger.warn(
              `Brand payout bank details are missing for refund ID ${refund.id}. ` +
                `Parking as pending_bank_details.`,
            );
            await refund.update({ status: 'pending_bank_details' });

            const campaign = await this.campaignRepository.findById(refund.campaignId);
            await this.notificationsService.notify({
              type: 'refund.bank_details_required',
              recipientId: refund.brandId,
              data: {
                campaignId: refund.campaignId,
                campaignTitle: campaign?.title ?? 'your campaign',
                refundId: refund.id,
                amount: Number(refund.amount),
                currency: refund.currency,
              },
              dedupeKey: `${refund.id}:bank_details`,
            });
            continue;
          }

          const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
            refund.campaignId,
          );
          if (campaignPayment?.escrowStatus !== 'completed') {
            this.logger.warn(
              `Escrow not yet released/completed for campaign ${refund.campaignId} ` +
                `(refund ID: ${refund.id}). Escrow status: ${campaignPayment?.escrowStatus ?? 'unknown'}. ` +
                `Parking refund as pending_escrow.`,
            );
            continue;
          }

          const refundRef = `ref_${refund.id.replace(/-/g, '').substring(0, 20)}`;

          this.logger.log(`Processing refund ID: ${refund.id}, Brand: ${brand.email}`);

          const success = await this.pandascrowService.requestPayout({
            payoutRef: refundRef,
            walletId: this.walletId,
            amount: refund.amount,
            currency: refund.currency || 'USD',
            bankCode: brand.bank.code,
            accountNumber: brand.bankAccountNumber,
            accountName: brand.bankAccountName || `${brand.firstName} ${brand.lastName}`,
          });

          if (success) {
            await refund.update({
              status: 'completed',
              refundReference: refundRef,
              errorDetails: null,
            });
            this.logger.log(`Successfully completed refund transfer for refund ID: ${refund.id}`);

            const campaign = await this.campaignRepository.findById(refund.campaignId);
            await this.notificationsService.notify({
              type: 'refund.completed',
              recipientId: refund.brandId,
              data: {
                campaignId: refund.campaignId,
                campaignTitle: campaign?.title ?? 'your campaign',
                refundId: refund.id,
                amount: Number(refund.amount),
                currency: refund.currency,
              },
              dedupeKey: refund.id,
            });
          } else {
            throw new Error('Pandascrow bank transfer returned failure');
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Refund failed for refund ID ${refund.id}: ${errMsg}`);
          await refund.update({
            status: 'failed',
            errorDetails: errMsg,
          });

          const campaign = await Promise.resolve(
            this.campaignRepository.findById(refund.campaignId),
          ).catch(() => null);
          const failureData = {
            campaignId: refund.campaignId,
            campaignTitle: campaign?.title ?? 'your campaign',
            refundId: refund.id,
            amount: Number(refund.amount),
            currency: refund.currency,
            reason: errMsg,
          };
          // Brand alert + finance-admin work item, one notification per refund
          // even though failed refunds may be retried on later cron runs.
          await this.notificationsService.notify({
            type: 'refund.failed',
            recipientId: refund.brandId,
            data: failureData,
            dedupeKey: `${refund.id}:failed`,
          });
          await this.notificationsService.notify({
            type: 'refund.failed',
            recipientRole: 'finance_admin',
            data: failureData,
            dedupeKey: `${refund.id}:failed:finance`,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing pending refunds: ${message}`);
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
