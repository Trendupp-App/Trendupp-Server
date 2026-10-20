import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignRepository } from '../repository/campaign.repository';
import { UsersService } from '../../users/services/users.service';
import { StartbuttonService } from '../../../integration/payment-gateway/startbutton.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../../integration/email/email.service';

@Injectable()
export class PayoutScheduler {
  private readonly logger = new Logger(PayoutScheduler.name);
  private readonly walletId: number;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly usersService: UsersService,
    private readonly startbuttonService: StartbuttonService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {
    this.walletId = this.configService.get<number>('pandascrow.walletId') || 1;
  }

  /**
   * Cron job that checks for creator payouts that are due (scheduled release date has passed).
   * Runs daily at midnight. EVERY_5_SECONDS
   */
  // EVERY_MINUTE
  // EVERY_DAY_AT_MIDNIGHT 6f7210db-dcd6-44e2-bbdf-a3388ea3a8c5
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

          if (!creator.bankAccountNumber || !creator.bankCode) {
            throw new Error('Creator payout bank details are missing or incomplete');
          }

          // Generate unique reference for this release payout.
          // By including the full release.id, we can extract it in the webhook.
          const payoutRef = `${release.id}-${Date.now()}`;

          this.logger.log(
            `Processing payout for release ID: ${release.id}, Creator: ${creator.email}`,
          );

          // Guard: only proceed with bank transfer if the startbutton escrow has been released.
          // The finance admin releases the escrow via the starbutton dashboard, which triggers
          // the escrow.completed webhook → updates Payment.escrowStatus → unblocks this release.
          const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
            release.campaignId,
          );
          const es = (campaignPayment?.escrowStatus || '').toLowerCase();
          if (es !== 'completed' && es !== 'funded') {
            this.logger.warn(
              `Escrow not yet funded/completed for campaign ${release.campaignId} ` +
                `(release ID: ${release.id}). ` +
                `Escrow status: ${campaignPayment?.escrowStatus ?? 'unknown'}. ` +
                `Parking as escrow_pending — will retry after escrow.completed webhook.`,
            );
            await release.update({ status: 'escrow_pending', errorDetails: null });

            // Work item for finance admins: release the escrow in startbutton.
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

          // Lock the record status immediately before making the external API call
          // to prevent concurrent cron executions / race conditions.
          await release.update({ status: 'processing' });

          const country = (typeof creator.country === 'string' ? creator.country : (creator.country as any)?.name) || 'Nigeria';

          // Trigger payout request from Trendupp's wallet to creator's bank account
          const success = await this.startbuttonService.requestPayout({
            payoutRef,
            amount: release.amount,
            currency: release.currency,
            country,
            bankCode: creator.bankCode,
            accountNumber: creator.bankAccountNumber,
            accountName: creator.bankAccountName || `${creator.firstName} ${creator.lastName}`,
          });

          if (success) {
            // Keep it in processing state, webhook will mark it as released
            this.logger.log(`Payout requested successfully for release ID: ${release.id}. Waiting for webhook.`);
          } else {
            throw new Error('Startbutton payout failed without explicit error');
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
        // Strike Calculation for no-show creators:
        // Get all accepted creators on this campaign, find if they had a release payout.
        // If not, they failed to go live and receive a strike.
        const releases = await this.campaignRepository.findReleasesByCampaignId(campaign.id);
        const paidCreatorIds = new Set(releases.map((r) => r.creatorId));

        const allApplications = await this.campaignRepository.findApplicationsByCampaignId(
          campaign.id,
        );
        const acceptedApps = allApplications.filter((app) => app.status === 'accepted');

        for (const app of acceptedApps) {
          if (!paidCreatorIds.has(app.creatorId)) {
            const creator = await this.usersService.findOne(app.creatorId);
            if (creator) {
              const currentStrikes = creator.creatorStrikes || [];
              if (!currentStrikes.includes(campaign.brandId)) {
                const updatedStrikes = [...currentStrikes, campaign.brandId];
                creator.creatorStrikes = updatedStrikes;
                if (updatedStrikes.length >= 3) {
                  creator.isActive = false;
                  creator.flaggedReason = `Blocked: Received 3 strikes from different advertisers: [${updatedStrikes.join(', ')}]`;
                  if (typeof creator.save === 'function') {
                    await creator.save();
                  }
                  await this.emailService.sendCreatorBlockEmail(creator.email, creator.firstName);
                } else {
                  creator.flaggedReason = `Warning: Received ${updatedStrikes.length} strike(s) from different advertisers: [${updatedStrikes.join(', ')}]`;
                  if (typeof creator.save === 'function') {
                    await creator.save();
                  }
                  await this.emailService.sendStrikeWarningEmail(
                    creator.email,
                    creator.firstName,
                    updatedStrikes.length,
                  );
                }
              }
            }
          }
        }

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
      const now = new Date();
      const pendingRefunds = await this.campaignRepository.findPendingRefunds(now);
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

          if (!brand.bankAccountNumber || !brand.bankCode) {
            this.logger.warn(
              `Brand payout bank details are missing for refund ID ${refund.id}. ` +
                `Parking as pending_bank_details.`,
            );
            await refund.update({ status: 'pending_bank_details' });
            continue;
          }

          const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(
            refund.campaignId,
          );
          const es = (campaignPayment?.escrowStatus || '').toLowerCase();
          if (es !== 'completed' && es !== 'funded') {
            this.logger.warn(
              `Escrow not yet released/completed for campaign ${refund.campaignId} ` +
                `(refund ID: ${refund.id}). Escrow status: ${campaignPayment?.escrowStatus ?? 'unknown'}. ` +
                `Parking refund as pending_escrow.`,
            );
            continue;
          }

          const refundRef = `ref_${refund.id.replace(/-/g, '').substring(0, 14)}_${Date.now().toString().slice(-5)}`;

          this.logger.log(`Processing refund ID: ${refund.id}, Brand: ${brand.email}`);

          const success = await this.startbuttonService.initiateRefund({
            transactionReference: campaignPayment?.transactionRef || campaignPayment?.paymentReference || '',
            amount: refund.amount,
            reason: `Refund for campaign ${refund.campaignId}`,
          });

          if (success) {
            await refund.update({
              status: 'completed',
              refundReference: refundRef,
              errorDetails: null,
            });
            this.logger.log(`Successfully completed refund transfer for refund ID: ${refund.id}`);

            const campaign = await this.campaignRepository
              .findById(refund.campaignId)
              .catch(() => null);
            await this.notificationsService.notify({
              type: 'refund.sent',
              recipientId: refund.brandId,
              data: {
                campaignId: refund.campaignId,
                campaignTitle: campaign?.title ?? 'your campaign',
                amount: Number(refund.amount),
                currency: refund.currency,
              },
              dedupeKey: `refund-sent:${refund.id}`,
            });
          } else {
            throw new Error('Startbutton refund returned failure');
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Refund failed for refund ID ${refund.id}: ${errMsg}`);
          await refund.update({
            status: 'failed',
            errorDetails: errMsg,
          });

          const campaign = await this.campaignRepository
            .findById(refund.campaignId)
            .catch(() => null);
          const failureData = {
            campaignId: refund.campaignId,
            campaignTitle: campaign?.title ?? 'your campaign',
            amount: Number(refund.amount),
            currency: refund.currency,
            reason: errMsg,
          };
          await this.notificationsService.notify({
            type: 'refund.failed',
            recipientId: refund.brandId,
            data: failureData,
            dedupeKey: `refund-failed:${refund.id}`,
          });
          await this.notificationsService.notify({
            type: 'refund.failed',
            recipientRole: 'finance_admin',
            data: failureData,
            dedupeKey: `refund-failed-finance:${refund.id}`,
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing pending refunds: ${message}`);
    }
  }

}
