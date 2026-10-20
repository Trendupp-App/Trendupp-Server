import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { CampaignRepository } from '../repository/campaign.repository';
import { TimelineService } from '../services/timeline.service';
import { CampaignRefund } from '../entities/campaign-refund.entity';
import { StartbuttonService } from '../../../integration/payment-gateway/startbutton.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

interface StartbuttonWebhookPayload {
  event: string;
  data: {
    reference?: string;
    transactionReference?: string;
    userTransactionReference?: string;
    transaction_reference?: string;
    user_transaction_reference?: string;
    refundReference?: string;
    transaction?: {
      transactionReference?: string;
      userTransactionReference?: string;
      transaction_reference?: string;
      user_transaction_reference?: string;
      reference?: string;
      status?: string;
      [key: string]: unknown;
    };
    reason?: string;
    [key: string]: unknown;
  };
  timestamp?: number;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly timelineService: TimelineService,
    private readonly startbuttonService: StartbuttonService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('startbutton')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Startbutton webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleStartbuttonWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-startbutton-signature') signature: string,
  ) {
    if (!req.rawBody) {
      this.logger.error('Raw request body is missing. Verify rawBody options in main.ts.');
      throw new BadRequestException('Raw request body is required');
    }

    const rawBodyString = req.rawBody.toString('utf8');
    let payload: StartbuttonWebhookPayload;
    try {
      payload = JSON.parse(rawBodyString) as StartbuttonWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const { event, data } = payload;

    if (!event || !data) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    // Verify signature
    const isValid = this.startbuttonService.verifyWebhookSignature(req.rawBody, signature);

    if (!isValid) {
      this.logger.warn(`Invalid signature detected for event: ${event}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Processing valid webhook event: ${event}`);

    // Process events
    switch (event) {
      case 'collection.completed':
      case 'collection.verified':
      case 'charge.success':
      case 'payment.successful': // Handle possible event names
        await this.handlePaymentSuccess(data);
        break;

      case 'transfer.completed':
      case 'transfer.success':
      case 'transfer.successful':
        await this.handleTransferSuccess(data);
        break;

      case 'transfer.failed':
      case 'transfer.reversed':
      case 'transfer.rejected':
        await this.handleTransferFailed(data);
        break;

      case 'refund.completed':
      case 'refund.success':
      case 'refund.successful':
        await this.handleRefundSuccess(data);
        break;

      case 'refund.failed':
      case 'refund.reversed':
      case 'refund.rejected':
        await this.handleRefundFailed(data);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${event}`);
        break;
    }

    return {
      status: true,
      message: 'Webhook received and processed successfully',
    };
  }

  private async handlePaymentSuccess(data: StartbuttonWebhookPayload['data']) {
    const userReference =
      data.transaction?.userTransactionReference ||
      data.transaction?.reference ||
      data.userTransactionReference ||
      data.reference;
    const gatewayReference = data.transaction?.transactionReference || data.transactionReference;

    const reference = userReference || gatewayReference;
    this.logger.log(
      `Payment success hook received for reference: ${reference} (userRef: ${userReference}, gatewayRef: ${gatewayReference})`,
    );

    if (!reference) {
      this.logger.warn(`Payment success hook received without reference: ${JSON.stringify(data)}`);
      return;
    }

    const payment = await this.campaignRepository.findPaymentByEscrowId(reference); // Using escrowId to store the Startbutton reference
    if (!payment) {
      this.logger.warn(`No payment record found for reference: ${reference}`);
      return;
    }

    // Update payment
    const paymentUpdates: Record<string, unknown> = {
      paymentStatus: 'paid',
      escrowStatus: 'funded',
    };
    if (gatewayReference) {
      paymentUpdates.transactionRef = gatewayReference;
    }
    await payment.update(paymentUpdates);

    // Transition campaign: pending_payment → live
    const campaign = await this.campaignRepository.findById(payment.campaignId);
    if (campaign) {
      if (campaign.status !== 'pending_payment') {
        this.logger.warn(
          `Escrow paid for campaign ${campaign.id} but status is '${campaign.status}' (expected 'pending_payment'). Proceeding to set live anyway.`,
        );
      }
      const approvedAt = new Date();
      const initialTimeline = this.timelineService.initCampaignTimeline(approvedAt);
      await campaign.update({
        paymentStatus: 'paid',
        status: 'live',
        approvedAt,
        timeline: initialTimeline,
      });
      this.logger.log(
        `Campaign ${campaign.id} transitioned pending_payment → live after payment confirmation.`,
      );

      // dedupeKey: Pandascrow may redeliver webhooks — notify the brand once.
      await this.notificationsService.notify({
        type: 'campaign.payment_confirmed',
        recipientId: campaign.brandId,
        data: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          amount: Number(payment.totalAmount ?? payment.amount),
          currency: campaign.currency,
          transactionRef: payment.transactionRef ?? payment.paymentReference,
          escrowId: payment.escrowId,
          paidAt: new Date().toISOString(),
        },
        dedupeKey: `${campaign.id}:live`,
      });

      // Fan out new campaign brief notification to creators
      const brandObj = campaign.brand;
      const advertiserName = brandObj
        ? `${brandObj.firstName || ''} ${brandObj.lastName || ''}`.trim() ||
          brandObj.username ||
          'An advertiser'
        : 'An advertiser';

      await this.notificationsService.notify({
        type: 'opportunity.new_campaign',
        recipientRole: 'creator',
        actorId: campaign.brandId,
        data: {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          advertiserName,
        },
        dedupeKey: `${campaign.id}:new_campaign`,
      });
    }
  }

  private extractReference(data: StartbuttonWebhookPayload['data']): string | undefined {
    const rawRef =
      data.transaction?.userTransactionReference ||
      data.transaction?.reference ||
      data.transaction?.user_transaction_reference ||
      data.transaction?.transaction_reference ||
      data.userTransactionReference ||
      data.reference ||
      data.user_transaction_reference ||
      data.transaction_reference ||
      data.transaction?.transactionReference ||
      data.transactionReference;
    return typeof rawRef === 'string' ? rawRef : undefined;
  }

  private async handleTransferSuccess(data: StartbuttonWebhookPayload['data']) {
    const reference = this.extractReference(data);
    this.logger.log(`Transfer success hook received for reference: ${reference}`);
    if (!reference) return;

    // Extract the standard 36-character UUID (8-4-4-4-12) from the reference
    const uuidMatch = reference.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    const releaseId: string = uuidMatch ? uuidMatch[0] : reference;

    const release = await this.campaignRepository.findReleaseById(releaseId);
    if (!release) {
      this.logger.warn(
        `No payment release found for reference: ${reference} (extracted ID: ${releaseId})`,
      );
      return;
    }

    if (release.status === 'released') {
      this.logger.log(`Release ${release.id} is already marked as released.`);
      return;
    }

    await release.update({
      status: 'released',
      errorDetails: null,
    });
    this.logger.log(
      `Successfully processed transfer success webhook for release ID: ${release.id}`,
    );

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
  }

  private async handleTransferFailed(data: StartbuttonWebhookPayload['data']) {
    const reference = this.extractReference(data);
    const reason =
      (typeof data.reason === 'string' && data.reason) || 'Startbutton transfer failed';
    this.logger.log(`Transfer failed hook received for reference: ${reference}, reason: ${reason}`);
    if (!reference) return;

    // Extract the standard 36-character UUID (8-4-4-4-12) from the reference
    const uuidMatch = reference.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    const releaseId: string = uuidMatch ? uuidMatch[0] : reference;

    const release = await this.campaignRepository.findReleaseById(releaseId);
    if (!release) {
      this.logger.warn(
        `No payment release found for reference: ${reference} (extracted ID: ${releaseId})`,
      );
      return;
    }

    if (release.status === 'failed') {
      return;
    }

    await release.update({
      status: 'failed',
      errorDetails: reason,
    });

    const campaign = await this.campaignRepository.findById(release.campaignId).catch(() => null);
    const failureData = {
      campaignId: release.campaignId,
      campaignTitle: campaign?.title ?? 'your campaign',
      releaseId: release.id,
      amount: Number(release.amount),
      currency: release.currency,
      reason,
    };

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

  /**
   * Checks if all payment releases and submissions for this campaign are done.
   * If yes, updates campaign status to 'completed'.
   */
  private async checkAndCompleteCampaign(campaignId: string): Promise<void> {
    try {
      const pendingCount = await this.campaignRepository.countPendingReleases(campaignId);
      if (pendingCount > 0) return;

      const activeSubmissions = await this.campaignRepository.countActiveSubmissions(campaignId);
      if (activeSubmissions > 0) return;

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

  private async handleRefundSuccess(data: StartbuttonWebhookPayload['data']) {
    const reference = this.extractReference(data);
    this.logger.log(`Refund success hook received for reference: ${reference}`);
    if (!reference) return;

    let refund: CampaignRefund | null = null;

    // 1. Check if reference contains a UUID that matches a refund ID directly
    const uuidMatch = reference.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (uuidMatch && uuidMatch[0]) {
      refund = await this.campaignRepository.findRefundById(uuidMatch[0]);
    }

    // 2. If not found by refund ID, look up the payment using the reference to get the campaignId
    if (!refund) {
      const payment = await this.campaignRepository.findPaymentByEscrowId(reference);
      if (payment?.campaignId) {
        refund = await this.campaignRepository.findRefundByCampaignId(payment.campaignId);
      }
    }

    if (!refund) {
      this.logger.warn(`No campaign refund found for reference: ${reference}`);
      return;
    }

    if (refund.status === 'completed') {
      this.logger.log(`Refund ${refund.id} is already marked as completed.`);
      return;
    }

    const refundReference =
      (typeof data.refundReference === 'string' && data.refundReference) || reference;

    await refund.update({
      status: 'completed',
      refundReference,
      errorDetails: null,
    });
    this.logger.log(`Successfully processed refund success webhook for refund ID: ${refund.id}`);

    const campaign = await this.campaignRepository.findById(refund.campaignId);
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
  }

  private async handleRefundFailed(data: StartbuttonWebhookPayload['data']) {
    const reference = this.extractReference(data);
    const reason = (typeof data.reason === 'string' && data.reason) || 'Startbutton refund failed';
    this.logger.log(`Refund failed hook received for reference: ${reference}, reason: ${reason}`);
    if (!reference) return;

    let refund: CampaignRefund | null = null;
    const uuidMatch = reference.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (uuidMatch && uuidMatch[0]) {
      refund = await this.campaignRepository.findRefundById(uuidMatch[0]);
    }
    if (!refund) {
      const payment = await this.campaignRepository.findPaymentByEscrowId(reference);
      if (payment?.campaignId) {
        refund = await this.campaignRepository.findRefundByCampaignId(payment.campaignId);
      }
    }

    if (!refund) {
      this.logger.warn(`No campaign refund found for reference: ${reference}`);
      return;
    }

    if (refund.status === 'failed') return;

    await refund.update({
      status: 'failed',
      errorDetails: reason,
    });

    const campaign = await this.campaignRepository.findById(refund.campaignId);
    await this.notificationsService.notify({
      type: 'refund.failed',
      recipientId: refund.brandId,
      data: {
        campaignId: refund.campaignId,
        campaignTitle: campaign?.title ?? 'your campaign',
        amount: Number(refund.amount),
        currency: refund.currency,
        reason,
      },
      dedupeKey: `refund-failed:${refund.id}`,
    });
  }
}
