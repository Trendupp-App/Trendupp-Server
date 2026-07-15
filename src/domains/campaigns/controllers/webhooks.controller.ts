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
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

interface PandascrowWebhookPayload {
  event: string;
  data: {
    escrow_id?: string | number;
    [key: string]: any;
  };
  timestamp: number;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly pandascrowService: PandascrowService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('pandascrow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Pandascrow webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handlePandascrowWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-pandascrow-signature') signature: string,
  ) {
    if (!req.rawBody) {
      this.logger.error('Raw request body is missing. Verify rawBody options in main.ts.');
      throw new BadRequestException('Raw request body is required');
    }

    const rawBodyString = req.rawBody.toString('utf8');
    let payload: PandascrowWebhookPayload;
    try {
      payload = JSON.parse(rawBodyString) as PandascrowWebhookPayload;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const { event, data, timestamp } = payload;

    if (!event || !data) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    // Verify signature
    const isValid = this.pandascrowService.verifyWebhookSignature(
      req.rawBody,
      signature,
      event,
      data,
      timestamp,
    );

    if (!isValid) {
      this.logger.warn(`Invalid signature detected for event: ${event}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Processing valid webhook event: ${event}`);

    // Process events
    switch (event) {
      case 'escrow.paid':
        await this.handleEscrowPaid(data);
        break;

      case 'escrow.completed':
        await this.handleEscrowCompleted(data);
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

  private async handleEscrowPaid(data: { escrow_id?: string | number }) {
    const escrowId = String(data.escrow_id);
    this.logger.log(`Escrow paid hook received for escrowId: ${escrowId}`);

    const payment = await this.campaignRepository.findPaymentByEscrowId(escrowId);
    if (!payment) {
      this.logger.warn(`No payment record found for escrow ID: ${escrowId}`);
      return;
    }

    // Update payment
    await payment.update({
      paymentStatus: 'paid',
      escrowStatus: 'funded',
    });

    // Transition campaign: pending_payment → live
    const campaign = await this.campaignRepository.findById(payment.campaignId);
    if (campaign) {
      if (campaign.status !== 'pending_payment') {
        this.logger.warn(
          `Escrow paid for campaign ${campaign.id} but status is '${campaign.status}' (expected 'pending_payment'). Proceeding to set live anyway.`,
        );
      }
      await campaign.update({
        paymentStatus: 'paid',
        status: 'live',
        approvedAt: new Date(),
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
        },
        dedupeKey: `${campaign.id}:live`,
      });
    }
  }

  private async handleEscrowCompleted(data: { escrow_id?: string | number }) {
    const escrowId = String(data.escrow_id);
    this.logger.log(`Escrow completed hook received for escrowId: ${escrowId}`);

    const payment = await this.campaignRepository.findPaymentByEscrowId(escrowId);
    if (!payment) {
      this.logger.warn(`No payment record found for escrow ID: ${escrowId}`);
      return;
    }

    // Mark the payment's escrow status as completed
    await payment.update({
      escrowStatus: 'completed',
    });
    this.logger.log(`Escrow ${escrowId} status updated to completed.`);

    // Unblock any payment_release rows that were parked awaiting escrow release.
    // This transitions them from 'escrow_pending' → 'pending' so the payout cron
    // picks them up on the next run.
    const unblocked = await this.campaignRepository.unblockEscrowPendingReleases(
      payment.campaignId,
    );
    if (unblocked > 0) {
      this.logger.log(
        `Unblocked ${unblocked} payment release(s) for campaign ${payment.campaignId} — now queued for payout.`,
      );
    }
  }
}
