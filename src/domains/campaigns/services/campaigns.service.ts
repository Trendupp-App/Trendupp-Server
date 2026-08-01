import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Campaign } from '../entities/campaign.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Platform } from '../entities/platform.entity';
import { Payment } from '../entities/payment.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { CampaignRepository } from '../repository/campaign.repository';
import { S3Service } from '../../../integration/s3/s3.service';
import { Fee } from '../entities/fee.entity';
import { CreateFeeDto } from '../dtos/create-fee.dto';
import { PaginatedResult } from '../../../shared/utils/pagination.utils';
import { CreateReviewDto } from '../dtos/create-review.dto';
import { FindAllCampaignsQueryDto } from '../dtos/find-all-campaigns-query.dto';
import { CampaignReview } from '../entities/campaign-review.entity';
import { CampaignComment } from '../entities/campaign-comment.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../../integration/email/email.service';
import { TimelineService } from './timeline.service';
import { Niche } from '../../users/entities/niche.entity';
import { Op } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';
import { BrandCommissionTier } from '../../admin/entities/brand-commission-tier.entity';

import { UserTokenLedger } from '../../users/entities/user-token-ledger.entity';
import { QuerySocialImpactCampaignsDto } from '../dtos/social-impact-query.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly s3Service: S3Service,
    private readonly usersService: UsersService,
    private readonly pandascrowService: PandascrowService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly timelineService: TimelineService,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(Fee)
    private readonly feeModel: typeof Fee,
    @InjectModel(BrandCommissionTier)
    private readonly commissionTierModel: typeof BrandCommissionTier,
    @InjectModel(UserTokenLedger)
    private readonly tokenLedgerModel: typeof UserTokenLedger,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  // ─── Billing Calculations ──────────────────────────────────────────────────

  async calculateBreakdown(
    budget: number,
    currency: string,
    brandId?: string,
  ): Promise<{
    campaignBudget: number;
    trenduppFee: number;
    vat: number;
    pandascrowFee: number;
    totalToPay: number;
    commissionRate: number;
    vatRate: number;
    gatewayRate: number;
    breakdownItems: { name: string; type: string; value: number; amount: number }[];
  }> {
    let trenduppRate = 0.15;
    if (brandId) {
      const customTier = await this.commissionTierModel.findOne({
        where: { brandIds: { [Op.contains]: [brandId] } },
      });
      if (customTier) {
        trenduppRate = customTier.ratePercentage / 100;
      } else {
        const defaultTier = await this.commissionTierModel.findOne({ where: { isDefault: true } });
        if (defaultTier) {
          trenduppRate = defaultTier.ratePercentage / 100;
        }
      }
    } else {
      const defaultTier = await this.commissionTierModel.findOne({ where: { isDefault: true } });
      if (defaultTier) {
        trenduppRate = defaultTier.ratePercentage / 100;
      }
    }

    // 1. VAT (7.5%) is deducted first from the brand's total budget.
    const vatFeeRecord = await this.feeModel.findOne({ where: { name: 'VAT' } });
    const vatRate = vatFeeRecord?.value ?? 0.075; // safe fallback to 7.5%
    const vat = Math.round(budget * vatRate);
    const amountAfterVat = budget - vat;

    // 2. Trendupp commission (15%) is deducted from the balance remaining after VAT.
    const trenduppFee = Math.round(amountAfterVat * trenduppRate);

    // 3. Final Creator budget pool = remaining balance after VAT minus Trendupp commission.
    const campaignBudget = amountAfterVat - trenduppFee;

    // 4. Pandascrow platform fee rate from fees table (3% NGN, 5% USD).
    // Gateway fee is deducted FROM the 15% Trendupp commission pool, NOT from creator budget pool.
    const feeKey =
      currency === 'NGN' ? 'Pandascrow Gateway Fee (NGN)' : 'Pandascrow Gateway Fee (USD)';
    const feeRecord = await this.feeModel.findOne({ where: { name: feeKey } });
    const pandascrowRate = feeRecord?.value ?? (currency === 'NGN' ? 0.03 : 0.05); // safe fallback
    const pandascrowFee = Math.round(trenduppFee * pandascrowRate);

    const breakdownItems: { name: string; type: string; value: number; amount: number }[] = [
      {
        name: 'VAT',
        type: 'percentage',
        value: vatRate,
        amount: vat,
      },
      {
        name: 'Trendupp Fee',
        type: 'percentage',
        value: trenduppRate,
        amount: trenduppFee,
      },
      {
        name: `Pandascrow Gateway Fee (${currency})`,
        type: 'percentage',
        value: pandascrowRate,
        amount: pandascrowFee,
      },
    ];

    return {
      campaignBudget,
      trenduppFee,
      vat,
      pandascrowFee,
      totalToPay: budget,
      commissionRate: trenduppRate,
      vatRate,
      gatewayRate: pandascrowRate,
      breakdownItems,
    };
  }

  async populateBreakdown(campaign: Campaign, requestingUserId?: string): Promise<Campaign> {
    if (campaign) {
      const breakdown = await this.calculateBreakdown(
        campaign.totalBudget,
        campaign.currency ?? 'USD',
        campaign.brandId,
      );
      campaign.paymentBreakdown = breakdown;

      // Attach application count
      const total = await this.campaignRepository.countApplications(campaign.id);
      campaign.setDataValue('applicationsCount' as any, { total });

      // Mask amplification asset link by default to protect it,
      // EXCEPT if the requester is the brand owner who created the campaign
      if (!requestingUserId || requestingUserId !== campaign.brandId) {
        campaign.setDataValue('amplificationAsset' as any, null);
      }

      // Populate creatorNiches and fallback creatorNiche
      if (campaign.creatorNicheIds && campaign.creatorNicheIds.length > 0) {
        const niches = await this.nicheModel.findAll({
          where: {
            id: {
              [Op.in]: campaign.creatorNicheIds,
            },
          },
        });

        campaign.setDataValue('creatorNiches' as any, niches);
        campaign.setDataValue('creatorNiche' as any, niches[0] || null);
      } else {
        campaign.setDataValue('creatorNiches' as any, []);
        campaign.setDataValue('creatorNiche' as any, null);
      }

      // Populate creatorCategories from the JSONB array
      if (campaign.creatorCategoryIds && campaign.creatorCategoryIds.length > 0) {
        const categories = await this.creatorCategoryModel.findAll({
          where: {
            id: {
              [Op.in]: campaign.creatorCategoryIds,
            },
          },
        });
        campaign.setDataValue('creatorCategories' as any, categories);
      } else {
        campaign.setDataValue('creatorCategories' as any, []);
      }
    }
    return campaign;
  }

  async populateBreakdowns(campaigns: Campaign[], requestingUserId?: string): Promise<Campaign[]> {
    await Promise.all(campaigns.map((c) => this.populateBreakdown(c, requestingUserId)));
    return campaigns;
  }

  async create(
    brandId: string,
    data: {
      title: string;
      goal: string;
      totalBudget: number;
      creatorCategoryIds: string[];
      creatorCategoryId?: string;
      preferredPlatformIds: string[];
      timeline?: Record<string, any>;
      creatorNicheId?: string;
      creatorNicheIds?: string[];
      campaignBrief?: string;
      contentGuidelines?: { dos: string[]; donts: string[] };
      amplificationAsset?: string;
    },
    files?: {
      coverImage?: Express.Multer.File;
      amplificationAssetFile?: Express.Multer.File;
    },
  ): Promise<Campaign> {
    let coverImage: string | undefined;
    if (files?.coverImage) {
      coverImage = await this.s3Service.uploadFile(files.coverImage);
    }

    let amplificationAsset = data.amplificationAsset;
    if (files?.amplificationAssetFile) {
      amplificationAsset = await this.s3Service.uploadFile(files.amplificationAssetFile);
    }

    const brand = await this.usersService.findOne(brandId);
    if (!brand) {
      throw new NotFoundException('Brand user profile not found');
    }
    const currency = brand.country?.currency || 'USD';

    const {
      preferredPlatformIds,
      timeline,
      creatorNicheId,
      creatorNicheIds,
      creatorCategoryIds,
      creatorCategoryId,
      ...campaignData
    } = data;

    const resolvedNicheIds = creatorNicheIds || (creatorNicheId ? [creatorNicheId] : []);
    const resolvedNicheId = creatorNicheId || (resolvedNicheIds && resolvedNicheIds[0]) || null;

    const resolvedCategoryIds =
      creatorCategoryIds && creatorCategoryIds.length > 0
        ? creatorCategoryIds
        : creatorCategoryId
          ? [creatorCategoryId]
          : [];
    const resolvedCategoryId =
      creatorCategoryId || (resolvedCategoryIds && resolvedCategoryIds[0]) || null;

    const campaign = await this.campaignRepository.create({
      ...campaignData,
      creatorNicheId: resolvedNicheId as string,
      creatorNicheIds: resolvedNicheIds,
      creatorCategoryId: resolvedCategoryId as string,
      creatorCategoryIds: resolvedCategoryIds,
      timeline,
      brandId,
      coverImage,
      amplificationAsset,
      status: 'draft',
      currentStep: 1,
      paymentStatus: 'unpaid',
      currency,
    });

    if (preferredPlatformIds && preferredPlatformIds.length > 0) {
      await campaign.$set('preferredPlatforms', preferredPlatformIds);
    }

    const populated = await this.campaignRepository.findById(campaign.id);
    return this.populateBreakdown(populated!, brandId);
  }

  async updateDraft(
    campaignId: string,
    brandId: string,
    data: {
      currentStep?: number;
      title?: string;
      goal?: string;
      totalBudget?: number;
      creatorCategoryIds?: string[];
      creatorCategoryId?: string;
      preferredPlatformIds?: string[];
      timeline?: string;
      creatorNicheId?: string;
      creatorNicheIds?: string[];
      deliverables?: string[];
      contentDirection?: string[];
      contentGuidelines?: { dos: string[]; donts: string[] };
      usageRights?: string;
      successLooksLike?: string;
      campaignBrief?: string;
      amplificationAsset?: string;
    },
    files?: {
      coverImage?: Express.Multer.File;
      amplificationAssetFile?: Express.Multer.File;
    },
  ): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    if (campaign.status !== 'draft') {
      throw new ForbiddenException(
        `Campaign is already submitted and cannot be modified as a draft`,
      );
    }

    let coverImage = campaign.coverImage;
    if (files?.coverImage) {
      coverImage = await this.s3Service.uploadFile(files.coverImage);
    }

    let amplificationAsset = campaign.amplificationAsset;
    if (files?.amplificationAssetFile) {
      amplificationAsset = await this.s3Service.uploadFile(files.amplificationAssetFile);
    } else if (data.amplificationAsset !== undefined) {
      amplificationAsset = data.amplificationAsset;
    }

    const {
      preferredPlatformIds,
      timeline,
      creatorNicheId,
      creatorNicheIds,
      creatorCategoryIds,
      creatorCategoryId,
      ...campaignData
    } = data;

    const updates: Record<string, unknown> = {
      ...campaignData,
      amplificationAsset,
    };
    if (timeline !== undefined) {
      updates.timeline = timeline ? new Date(timeline) : null;
    }
    if (files?.coverImage) {
      updates.coverImage = coverImage;
    }

    if (creatorNicheIds !== undefined || creatorNicheId !== undefined) {
      const resolvedNicheIds =
        creatorNicheIds !== undefined ? creatorNicheIds : creatorNicheId ? [creatorNicheId] : [];
      const resolvedNicheId =
        creatorNicheId !== undefined
          ? creatorNicheId
          : (resolvedNicheIds && resolvedNicheIds[0]) || null;

      updates.creatorNicheId = resolvedNicheId;
      updates.creatorNicheIds = resolvedNicheIds;
    }

    if (creatorCategoryIds !== undefined || creatorCategoryId !== undefined) {
      const resolvedCategoryIds =
        creatorCategoryIds !== undefined
          ? creatorCategoryIds
          : creatorCategoryId
            ? [creatorCategoryId]
            : [];
      const resolvedCategoryId =
        creatorCategoryId !== undefined
          ? creatorCategoryId
          : (resolvedCategoryIds && resolvedCategoryIds[0]) || null;

      updates.creatorCategoryId = resolvedCategoryId;
      updates.creatorCategoryIds = resolvedCategoryIds;
    }

    if (files?.coverImage) {
      updates.coverImage = coverImage;
    }

    await campaign.update(updates);

    if (preferredPlatformIds !== undefined) {
      await campaign.$set('preferredPlatforms', preferredPlatformIds);
    }

    const populated = await this.campaignRepository.findById(campaign.id);
    return this.populateBreakdown(populated!, brandId);
  }

  async submit(
    campaignId: string,
    brandId: string,
  ): Promise<{
    campaign: Campaign;
    payment: Payment;
  }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    // Load brand profile details & check bank details
    const brand = await this.usersService.findOne(brandId);
    if (!brand) {
      throw new NotFoundException('Brand user profile not found');
    }

    const hasBankDetails = brand.bankId && brand.bankAccountNumber && brand.bankAccountName;
    if (!hasBankDetails) {
      throw new ForbiddenException('kindly add your refund details in the profile section');
    }

    // Allow re-submission when payment is still pending (retry / refresh checkout URL)
    const isPaymentRetry =
      campaign.status === 'pending_payment' && campaign.paymentStatus === 'pending';

    if (campaign.status !== 'draft' && !isPaymentRetry) {
      throw new ForbiddenException(
        `Campaign cannot be submitted in its current state (status: ${campaign.status})`,
      );
    }

    // Only run completeness validation on fresh submissions from 'draft'.
    // On retry (pending_payment), the campaign data is frozen — updateDraft() blocks
    // edits once the campaign leaves draft, so we know it was already validated.
    if (!isPaymentRetry) {
      const errors: string[] = [];
      if (!campaign.title) errors.push('title is required');
      if (!campaign.goal) errors.push('goal is required');
      if (!campaign.totalBudget) errors.push('totalBudget is required');
      if (!campaign.creatorCategoryIds || campaign.creatorCategoryIds.length === 0) {
        errors.push('creatorCategory is required');
      }
      if (!campaign.creatorNicheIds || campaign.creatorNicheIds.length === 0) {
        errors.push('creatorNiche is required');
      }
      if (!campaign.preferredPlatforms || campaign.preferredPlatforms.length === 0) {
        errors.push('at least one preferred platform is required');
      }
      if (!campaign.deliverables || campaign.deliverables.length === 0) {
        errors.push('deliverables list is required');
      }
      if (!campaign.contentDirection || campaign.contentDirection.length === 0) {
        errors.push('contentDirection is required');
      }
      if (
        !campaign.contentGuidelines ||
        (!campaign.contentGuidelines.dos && !campaign.contentGuidelines.donts)
      ) {
        errors.push('contentGuidelines are required');
      }
      if (!campaign.campaignBrief) errors.push('campaignBrief is required');

      if (campaign.goal === 'Amplify Content' && !campaign.amplificationAsset) {
        errors.push('amplificationAsset is required for Content Amplification campaigns');
      }
      if (errors.length > 0) {
        throw new ForbiddenException(`Cannot submit incomplete campaign: ${errors.join(', ')}`);
      }
    }

    // Retry path: cancel the existing stale pending payment so we get a clean slate
    if (isPaymentRetry) {
      const existingPayment = await this.campaignRepository.findPaymentByCampaignId(campaignId);
      if (existingPayment && existingPayment.paymentStatus === 'pending') {
        await this.campaignRepository.updatePayment(existingPayment.id, {
          paymentStatus: 'cancelled',
        });
      }
    }

    const breakdown = await this.calculateBreakdown(campaign.totalBudget, campaign.currency);

    // Initialize escrow on Pandascrow
    const timelineObj = campaign.timeline as
      | Record<string, { endedDate?: string }>
      | null
      | undefined;
    const endedDateStr = timelineObj?.stage1_application_window?.endedDate;
    const rawDeliveryDate = endedDateStr
      ? new Date(endedDateStr)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const deliveryDateStr = rawDeliveryDate.toISOString().split('T')[0];
    const escrow = await this.pandascrowService.initializeEscrow({
      title: campaign.title,
      description: campaign.campaignBrief!,
      amount: breakdown.totalToPay,
      currency: campaign.currency, // Nigeria -> NGN, other countries -> USD
      deliveryDate: deliveryDateStr,
      buyerDetails: {
        name: `${brand.firstName} ${brand.lastName}`,
        email: 'trenduppfinance@gmail.com', //brand.email,
        phone: '', //brand.phoneNumber || '',
      },
      sellerDetails: {
        name: 'Trendupp Platform',
        email: 'app@trendupp.com', //if the email is app@trendup it would default to the default email which is "app@trnedp" but if you change it that email would recieve the email
        phone: '',
      },
    });

    await campaign.update({
      status: 'pending_payment',
      currentStep: 5,
      acceptedTerms: true,
      paymentStatus: 'pending',
    });

    // Create pending payment record
    // Snapshot the fee rates at payment time so the breakdown remains accurate
    // even if the admin later updates commission/VAT/gateway rates.
    // (3% for NGN/Paystack, 5% for USD/Stripe)
    const payment = await this.campaignRepository.createPayment({
      campaignId: campaign.id,
      amount: breakdown.campaignBudget,
      totalAmount: breakdown.totalToPay,
      commissionFee: breakdown.trenduppFee,
      vatFee: breakdown.vat,
      gatewayFee: breakdown.pandascrowFee,
      commissionRate: breakdown.commissionRate,
      vatRate: breakdown.vatRate,
      gatewayRate: breakdown.gatewayRate,
      paymentStatus: 'pending',
      currency: campaign.currency,
      paymentReference: escrow.transaction_ref,
      escrowId: String(escrow.escrow_id),
      paymentUrl: escrow.payment_url,
      transactionRef: escrow.transaction_ref,
      provider: escrow.provider,
      escrowStatus: escrow.status,
    });

    const populated = await this.campaignRepository.findById(campaign.id);
    if (populated) {
      populated.paymentBreakdown = breakdown;
    }

    return {
      campaign: populated!,
      payment,
    };
  }

  /**
   * Verifies campaign payment directly via Pandascrow status lookup.
   * Performs idempotency checks so that duplicate calls or concurrent webhook calls
   * do not duplicate updates or notification emails.
   */
  async verifyPayment(
    campaignId: string,
    brandId: string,
    escrowId?: string,
  ): Promise<{
    message: string;
    campaign: Campaign;
    payment: Payment;
    alreadyVerified: boolean;
  }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You do not own this campaign');
    }

    // Find payment record matching escrowId (if provided) or latest for this campaign
    const payment = escrowId
      ? await this.campaignRepository.findPaymentByCampaignAndEscrowId(campaignId, escrowId)
      : await this.campaignRepository.findPaymentByCampaignId(campaignId);

    if (!payment) {
      throw new NotFoundException('No payment record found for this campaign');
    }

    // ── 1. Idempotency Check ─────────────────────────────────────────────────
    // If the campaign is already live or payment is already paid, return cleanly.
    if (campaign.status === 'live' || payment.paymentStatus === 'paid') {
      this.logger.log(
        `[verifyPayment] Campaign ${campaignId} is already verified and marked paid. Returning cleanly.`,
      );
      return {
        message: 'Campaign payment is already verified and live.',
        campaign,
        payment,
        alreadyVerified: true,
      };
    }

    // ── 2. Pandascrow Status Check ──────────────────────────────────────────
    let isFunded = false;
    const pandascrowLookupId = payment.escrowId || payment.transactionRef || escrowId;

    if (pandascrowLookupId) {
      try {
        const escrowDetails = await this.pandascrowService.getEscrowDetails(pandascrowLookupId);

        const st = (escrowDetails.status || '').toLowerCase();
        isFunded = st === 'funded' || st === 'paid' || st === 'completed';
      } catch (err) {
        this.logger.error(
          `[verifyPayment] Error fetching escrow details for lookupId ${pandascrowLookupId}: ${err}`,
        );
      }
    }

    if (!isFunded) {
      throw new BadRequestException(
        'Payment has not been confirmed by the payment gateway yet, we are taking a moment to confirm it.',
      );
    }

    // ── 3. Perform Updates & Send Notifications ─────────────────────────────
    await payment.update({
      paymentStatus: 'paid',
      escrowStatus: 'funded',
    });

    const approvedAt = new Date();
    const initialTimeline = this.timelineService.initCampaignTimeline(approvedAt);

    await campaign.update({
      paymentStatus: 'paid',
      status: 'live',
      approvedAt,
      timeline: initialTimeline,
    });

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

    const updatedCampaign = (await this.campaignRepository.findById(campaignId))!;

    return {
      message: 'Payment verified successfully. Campaign is now live!',
      campaign: updatedCampaign,
      payment,
      alreadyVerified: false,
    };
  }

  async findAll(
    query: FindAllCampaignsQueryDto = {},
    user?: User,
  ): Promise<PaginatedResult<Campaign>> {
    // 1. Identify if the requester is a creator and has not selected explicit niche filters
    const roleRaw: unknown = user?.role;
    const role =
      typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
        ? (roleRaw as { name: string }).name
        : ((roleRaw as string | undefined) ?? '');

    const isCreator = role.toLowerCase() === 'creator';
    const hasNicheFilters =
      (query.nicheIds && query.nicheIds.length > 0) || (query.niches && query.niches.length > 0);

    let prioritizeNicheIds: string[] | undefined;
    if (isCreator && !hasNicheFilters && user?.niches) {
      prioritizeNicheIds = user.niches.map((n) => n.id);
    }

    const result = await this.campaignRepository.findAll(query, prioritizeNicheIds);
    result.data = await this.populateBreakdowns(result.data, user?.id);

    // Ensure all live/active campaigns have stage 0-2 timeline populated for creator countdown cards
    result.data.forEach((c) => {
      if (!c.timeline && (c.status === 'live' || c.status === 'active')) {
        const approvedAt = c.approvedAt
          ? new Date(c.approvedAt)
          : c.createdAt
            ? new Date(c.createdAt)
            : new Date();
        c.setDataValue('timeline' as any, this.timelineService.initCampaignTimeline(approvedAt));
      }
    });

    // For virtual statuses, override the status field in the response so the
    // frontend receives the filter name it sent, not the raw DB value.
    // NOTE: 'active' is now a real DB column value so no override needed.
    if (query.status === 'content_review' || query.status === 'revisions') {
      result.data.forEach((c) => c.setDataValue('status' as any, query.status));
    }

    return result;
  }

  async findById(id: string, requestingUser?: { id: string; role?: string }): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Determine authorization to view the amplification asset before it is masked
    let isAuthorized = false;
    if (requestingUser) {
      const roleRaw: unknown = requestingUser.role;
      const role =
        typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
          ? (roleRaw as { name: string }).name
          : ((roleRaw as string | undefined) ?? '');

      const isAdmin = [
        'owner',
        'admin',
        'superadmin',
        'super_admin',
        'finance_admin',
        'moderator',
        'support_agent',
      ].includes(role.toLowerCase());
      const isBrandOwner = campaign.brandId === requestingUser.id;

      if (isAdmin || isBrandOwner) {
        isAuthorized = true;
      } else if (role === 'creator') {
        const hasAcceptedApp = campaign.applications?.some(
          (app) => app.creatorId === requestingUser.id && app.status === 'accepted',
        );
        if (hasAcceptedApp) {
          isAuthorized = true;
        }
      }
    }

    const rawAsset = campaign.amplificationAsset;

    await this.populateBreakdown(campaign, requestingUser?.id);

    // Format creators_timeline for accepted/selected applicants
    const creatorsTimeline = this.timelineService.formatCreatorsTimeline(
      campaign.applications || [],
      campaign.goal,
    );
    campaign.setDataValue('creators_timeline' as any, creatorsTimeline);

    // If authorized, restore the real asset link. Otherwise, it remains masked (null).
    if (isAuthorized && rawAsset) {
      campaign.setDataValue('amplificationAsset' as any, rawAsset);
    }

    // Filter applications based on requester role
    if (campaign.applications && requestingUser) {
      const roleRaw: unknown = requestingUser.role;
      const role =
        typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
          ? (roleRaw as { name: string }).name
          : ((roleRaw as string | undefined) ?? '');

      if (role === 'brand') {
        // Brand owner sees all applications; non-owners see none
        if (campaign.brandId !== requestingUser.id) {
          campaign.setDataValue('applications' as any, []);
        }
      } else if (role === 'creator') {
        // Creators only see their own application
        const ownApplication = campaign.applications.filter(
          (app) => app.creatorId === requestingUser.id,
        );
        campaign.setDataValue('applications' as any, ownApplication);
      } else {
        // Admins see all applications
      }
    } else if (campaign.applications && !requestingUser) {
      // Public (unauthenticated) access — strip all applications
      campaign.setDataValue('applications' as any, []);
    }

    if (requestingUser) {
      const roleRaw: unknown = requestingUser.role;
      const role =
        typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
          ? (roleRaw as { name: string }).name
          : ((roleRaw as string | undefined) ?? '');

      if (role === 'creator') {
        const commentRecord = await this.campaignRepository.findCommentByCampaignAndCreator(
          id,
          requestingUser.id,
        );
        campaign.setDataValue('campaignComment' as any, commentRecord);
      } else if (role === 'brand' && campaign.brandId === requestingUser.id) {
        const comments = await this.campaignRepository.findCommentsByCampaign(id);
        campaign.setDataValue('campaignComments' as any, comments);
      }
    }

    return campaign;
  }

  async findByBrandId(brandId: string, status?: string): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.findByBrandId(brandId, status);
    return this.populateBreakdowns(campaigns, brandId);
  }

  async findLive(pagination?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Campaign>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const result = await this.campaignRepository.findLiveCampaigns(page, limit);
    result.data = await this.populateBreakdowns(result.data);
    return result;
  }

  async findPast(pagination?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Campaign>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const result = await this.campaignRepository.findPastCampaigns(page, limit);
    result.data = await this.populateBreakdowns(result.data);
    return result;
  }

  // ─── Lookup endpoints ─────────────────────────────────────────────────────

  getCreatorCategories(): Promise<CreatorCategory[]> {
    return this.campaignRepository.findAllCategories();
  }

  getPlatforms(): Promise<Platform[]> {
    return this.campaignRepository.findAllPlatforms();
  }

  /**
   * Approve a pending campaign — sets status to 'live' and stamps approvedAt.
   * Only campaigns in 'pending_approval' status can be approved.
   */
  async approve(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== 'pending_approval') {
      throw new ForbiddenException(
        `Campaign is already "${campaign.status}" and cannot be approved`,
      );
    }

    const updated = await this.campaignRepository.updateStatus(campaignId, 'approved', new Date());
    return this.populateBreakdown(updated!);
  }

  async applyToCampaign(
    campaignId: string,
    creatorId: string,
    data: {
      contentIdea: string;
      pastWorkLink?: string[];
      primaryPlatformId: string;
      secondaryPlatformId?: string;
      feeRequest: number;
      comments?: string;
    },
  ): Promise<CampaignApplication> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== 'live') {
      throw new ForbiddenException(`Oops! You can only apply to live campaigns. Kindly refresh!`);
    }

    // ── Profile completeness guard ────────────────────────────────────────────
    // Creators must have at least one social account connected before they can
    // apply to any campaign. Load with niches so onboardingStepsCompleted
    // computes correctly.
    const creator = await this.usersService.findOneWithNiches(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    const hasSocials = Object.values(creator.socialsConnected).some((connected) => connected);
    if (!hasSocials) {
      throw new ForbiddenException(
        'Your profile is incomplete. Please connect at least one social account (Instagram, TikTok, YouTube, or Twitter) before applying to campaigns.',
      );
    }

    const hasBankDetails = creator.bankId && creator.bankAccountNumber && creator.bankAccountName;
    if (!hasBankDetails) {
      throw new ForbiddenException('kindly add your payout details in the profile section');
    }
    // ─────────────────────────────────────────────────────────────────────────

    const existingApp = await this.campaignRepository.findApplication(campaignId, creatorId);
    if (existingApp) {
      throw new ForbiddenException(`You have already applied to this campaign`);
    }

    const { comments, ...applicationData } = data;

    if (comments && comments.trim()) {
      const existingComment = await this.campaignRepository.findCommentByCampaignAndCreator(
        campaignId,
        creatorId,
      );
      if (existingComment) {
        throw new ForbiddenException(
          `You have already submitted a comment/question for this campaign`,
        );
      }
    }

    const application = await this.campaignRepository.createApplication({
      campaignId,
      creatorId,
      ...applicationData,
    });

    if (comments && comments.trim()) {
      await this.campaignRepository.createComment({
        campaignId,
        creatorId,
        brandId: campaign.brandId,
        comment: comments,
      });
    }

    await this.notificationsService.notify({
      type: 'application.submitted',
      recipientId: campaign.brandId,
      actorId: creatorId,
      data: {
        campaignId,
        campaignTitle: campaign.title,
        applicationId: application.id,
        creatorName: `${creator.firstName} ${creator.lastName}`.trim(),
      },
    });

    const populated = await this.campaignRepository.findApplicationById(application.id);
    if (populated) {
      if (populated.campaign) {
        await this.populateBreakdown(populated.campaign);
      }
      const commentRecord = await this.campaignRepository.findCommentByCampaignAndCreator(
        populated.campaignId,
        populated.creatorId,
      );
      if (typeof populated.setDataValue === 'function') {
        populated.setDataValue('campaignComment' as any, commentRecord);
        populated.setDataValue('comments' as any, undefined);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (populated as any).campaignComment = commentRecord;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete (populated as any).comments;
      }
    }
    return populated!;
  }

  async getCampaignApplications(
    campaignId: string,
    brandId: string,
    userRole?: string,
  ): Promise<CampaignApplication[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isStaffOrOwner = [
      'owner',
      'admin',
      'superadmin',
      'super_admin',
      'finance_admin',
      'moderator',
      'support_agent',
    ].includes(userRole?.toLowerCase() || '');

    if (campaign.brandId !== brandId && !isStaffOrOwner) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const applications = await this.campaignRepository.findApplicationsByCampaignId(campaignId);
    for (const app of applications) {
      const commentRecord = await this.campaignRepository.findCommentByCampaignAndCreator(
        app.campaignId,
        app.creatorId,
      );
      if (typeof app.setDataValue === 'function') {
        app.setDataValue('campaignComment' as any, commentRecord);
        app.setDataValue('comments' as any, undefined);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (app as any).campaignComment = commentRecord;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete (app as any).comments;
      }
    }
    return applications;
  }

  async reviewCampaignApplication(
    campaignId: string,
    appId: string,
    callerId: string,
    status: string,
    callerRole: string = 'brand',
  ): Promise<CampaignApplication> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isAdmin = ['admin', 'superadmin'].includes(callerRole);

    // Brands must own the campaign; admins can act on any campaign
    if (!isAdmin && campaign.brandId !== callerId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const application = await this.campaignRepository.findApplicationById(appId);
    if (!application || application.campaignId !== campaignId) {
      throw new NotFoundException('Application not found');
    }

    // Attempting to undo an already-accepted application
    if (application.status === 'accepted' && status === 'rejected') {
      if (!isAdmin) {
        throw new ForbiddenException(
          `You do not have sufficient access to undo an accepted application. Please contact support.`,
        );
      }
      // Admin undo: revert application + campaign back to live
      await application.update({ status: 'rejected' });
      await campaign.update({ status: 'live' });

      await this.notificationsService.notify({
        type: 'application.acceptance_undone',
        recipientId: [application.creatorId, campaign.brandId],
        actorId: callerId,
        data: { campaignId, campaignTitle: campaign.title, applicationId: application.id },
      });

      const updated = await this.campaignRepository.findApplicationById(appId);
      if (updated?.campaign) await this.populateBreakdown(updated.campaign);
      return updated!;
    }

    // Normal path: update application status
    const appUpdates: Record<string, any> = { status };
    if (status === 'accepted') {
      appUpdates.timeline = this.timelineService.initCreatorApplicationTimeline(campaign.goal);
    }
    await application.update(appUpdates);

    // When a brand accepts an application, promote the campaign to active and update stage2 timeline
    if (status === 'accepted') {
      const updatedCampaignTimeline = this.timelineService.completeApplicationReview(
        campaign.timeline,
      );
      await campaign.update({ status: 'active', timeline: updatedCampaignTimeline });
    }

    if (status === 'accepted' || status === 'rejected') {
      await this.notificationsService.notify({
        type: status === 'accepted' ? 'application.accepted' : 'application.rejected',
        recipientId: application.creatorId,
        actorId: callerId,
        data: { campaignId, campaignTitle: campaign.title, applicationId: application.id },
      });
    }

    const updated = await this.campaignRepository.findApplicationById(appId);
    if (updated?.campaign) {
      await this.populateBreakdown(updated.campaign);
    }
    return updated!;
  }

  async reviewCampaignApplicationsBatch(
    campaignId: string,
    applicationIds: string[],
    callerId: string,
    status: string,
    callerRole: string = 'brand',
  ): Promise<CampaignApplication[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isAdmin = ['admin', 'superadmin'].includes(callerRole);

    // Brands must own the campaign; admins can act on any campaign
    if (!isAdmin && campaign.brandId !== callerId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    if (status === 'accepted') {
      const validation = await this.validateCreatorSelection(campaignId, applicationIds);
      if (!validation.isValid) {
        throw new BadRequestException(validation.message);
      }
    }

    const results: CampaignApplication[] = [];

    for (const appId of applicationIds) {
      const application = await this.campaignRepository.findApplicationById(appId);
      if (!application || application.campaignId !== campaignId) {
        throw new NotFoundException(
          `Application ${appId} not found or does not belong to this campaign`,
        );
      }

      // Attempting to undo an already-accepted application
      if (application.status === 'accepted' && status === 'rejected') {
        if (!isAdmin) {
          throw new ForbiddenException(
            `You do not have sufficient access to undo an accepted application. Please contact support.`,
          );
        }
        // Admin undo: revert application + campaign back to live
        await application.update({ status: 'rejected' });
        await campaign.update({ status: 'live' });
      } else {
        // Normal path: update application status
        const appUpdates: Record<string, any> = { status };
        if (status === 'accepted') {
          appUpdates.timeline = this.timelineService.initCreatorApplicationTimeline(campaign.goal);
        }
        await application.update(appUpdates);

        // When a brand accepts an application, promote the campaign to active and complete stage2 review
        if (status === 'accepted') {
          const updatedCampaignTimeline = this.timelineService.completeApplicationReview(
            campaign.timeline,
          );
          await campaign.update({ status: 'active', timeline: updatedCampaignTimeline });
        }
      }

      const updated = await this.campaignRepository.findApplicationById(appId);
      if (updated) {
        if (updated.campaign) {
          await this.populateBreakdown(updated.campaign);
        }
        results.push(updated);
      }
    }

    // If accepting a batch of creators, auto-reject all other applications that were not chosen
    if (status === 'accepted') {
      const allApplications =
        await this.campaignRepository.findApplicationsByCampaignId(campaignId);
      for (const app of allApplications) {
        if (!applicationIds.includes(app.id) && app.status !== 'rejected') {
          await app.update({ status: 'rejected' });
        }
      }
    }

    return results;
  }

  async validateCreatorSelection(
    campaignId: string,
    applicationIds: string[],
  ): Promise<{
    isValid: boolean;
    amountAvailable: number;
    selectedTotal: number;
    shortfall: number;
    currency: string;
    message: string;
  }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const payment = await this.campaignRepository.findPaymentByCampaignId(campaignId);
    // If not paid yet, derive the expected creator pool via the same breakdown logic.
    // This correctly accounts for Pandascrow platform fee (3% NGN, 5% USD).
    let amountAvailable: number;
    if (payment && payment.paymentStatus === 'paid') {
      amountAvailable = payment.amount;
    } else {
      const estimatedBreakdown = await this.calculateBreakdown(
        campaign.totalBudget,
        campaign.currency,
      );
      amountAvailable = estimatedBreakdown.campaignBudget;
    }

    let selectedTotal = 0;
    for (const appId of applicationIds) {
      const app = await this.campaignRepository.findApplicationById(appId);
      if (app && app.campaignId === campaignId) {
        selectedTotal += app.feeRequest || 0;
      }
    }

    const shortfall = Math.max(0, selectedTotal - amountAvailable);
    const isValid = shortfall === 0;

    const currencySymbol = campaign.currency === 'NGN' ? '₦' : '$';
    let message = `Selection is valid. The selected creators' total fee of ${currencySymbol}${selectedTotal.toLocaleString()} fits inside the available budget pool of ${currencySymbol}${amountAvailable.toLocaleString()}.`;

    if (!isValid) {
      message = `Selected creators' total of ${currencySymbol}${selectedTotal.toLocaleString()} exceeds the available campaign budget of ${currencySymbol}${amountAvailable.toLocaleString()} by ${currencySymbol}${shortfall.toLocaleString()}. Please swap creators or fund a new campaign for the extra creators.`;
    }

    return {
      isValid,
      amountAvailable,
      selectedTotal,
      shortfall,
      currency: campaign.currency,
      message,
    };
  }

  async getMyApplications(creatorId: string): Promise<CampaignApplication[]> {
    const apps = await this.campaignRepository.findApplicationsByCreatorId(creatorId);
    for (const app of apps) {
      if (app.campaign) {
        await this.populateBreakdown(app.campaign);
      }
      const commentRecord = await this.campaignRepository.findCommentByCampaignAndCreator(
        app.campaignId,
        app.creatorId,
      );
      if (typeof app.setDataValue === 'function') {
        app.setDataValue('campaignComment' as any, commentRecord);
        app.setDataValue('comments' as any, undefined);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (app as any).campaignComment = commentRecord;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete (app as any).comments;
      }
    }
    return apps;
  }

  async getApplicationById(
    appId: string,
    userId: string,
    role: string,
  ): Promise<CampaignApplication> {
    const application = await this.campaignRepository.findApplicationById(appId);
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const isAdmin = ['admin', 'finance_admin', 'superadmin'].includes(role);
    if (isAdmin) {
      if (application.campaign) {
        await this.populateBreakdown(application.campaign);
      }
    } else if (role === 'creator') {
      if (application.creatorId !== userId) {
        throw new ForbiddenException(`You do not own this application`);
      }
      if (application.campaign) {
        await this.populateBreakdown(application.campaign);
      }
    } else if (role === 'brand') {
      if (application.campaign?.brandId !== userId) {
        throw new ForbiddenException(`You do not own the campaign for this application`);
      }
      await this.populateBreakdown(application.campaign);
    } else {
      throw new ForbiddenException(`Unauthorized access`);
    }

    const commentRecord = await this.campaignRepository.findCommentByCampaignAndCreator(
      application.campaignId,
      application.creatorId,
    );
    if (typeof application.setDataValue === 'function') {
      application.setDataValue('campaignComment' as any, commentRecord);
      application.setDataValue('comments' as any, undefined);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (application as any).campaignComment = commentRecord;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      delete (application as any).comments;
    }

    return application;
  }

  // ─── Content Submissions Flow ─────────────────────────────────────────────

  async submitDraft(
    campaignId: string,
    applicationId: string,
    creatorId: string,
    draftLink: string,
  ): Promise<ContentSubmission> {
    const application = await this.campaignRepository.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.creatorId !== creatorId) {
      throw new ForbiddenException(`You do not own this application`);
    }

    // Must be accepted (In Progress) or request_revision status
    const previousSub =
      await this.campaignRepository.findLatestSubmissionByApplicationId(applicationId);

    if (previousSub) {
      if (previousSub.status !== 'request_revision') {
        throw new ForbiddenException(
          `You cannot submit a new draft. Wait for brand to request revision or approve the current.`,
        );
      }
      // Re-submission / Revision
      await previousSub.update({
        draftLink,
        status: 'revision-sent',
        brandFeedback: null,
      });

      if (typeof application?.update === 'function') {
        const revisedTimeline = this.timelineService.recordRevisedDraftSubmission(
          application.timeline,
        );
        await application.update({ timeline: revisedTimeline });
      }

      const campaign = application.campaign ?? (await this.campaignRepository.findById(campaignId));
      if (campaign) {
        await this.notificationsService.notify({
          type: 'submission.revision_resubmitted',
          recipientId: campaign.brandId,
          actorId: creatorId,
          data: { campaignId, campaignTitle: campaign.title, submissionId: previousSub.id },
        });
      }

      const updated = await this.campaignRepository.findSubmissionById(previousSub.id);
      return updated!;
    } else {
      if (application.status !== 'accepted') {
        throw new ForbiddenException(`You can only submit drafts for accepted applications`);
      }
      // First draft submission
      if (typeof application?.update === 'function') {
        const draftTimeline = this.timelineService.recordDraftSubmission(application.timeline);
        await application.update({ timeline: draftTimeline });
      }
      const submission = await this.campaignRepository.createSubmission({
        campaignId,
        applicationId,
        creatorId,
        draftLink,
        status: 'pending_approval',
      });

      const campaign = application.campaign ?? (await this.campaignRepository.findById(campaignId));
      if (campaign) {
        await this.notificationsService.notify({
          type: 'submission.draft_submitted',
          recipientId: campaign.brandId,
          actorId: creatorId,
          data: { campaignId, campaignTitle: campaign.title, submissionId: submission.id },
        });
      }

      const populated = await this.campaignRepository.findSubmissionById(submission.id);
      return populated!;
    }
  }

  async vetDraft(
    campaignId: string,
    submissionId: string,
    brandId: string,
    decision: 'approved' | 'request_revision' | 'rejected',
    brandFeedback?: string,
    userRole?: string,
  ): Promise<ContentSubmission> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isStaffOrOwner = [
      'owner',
      'admin',
      'superadmin',
      'super_admin',
      'finance_admin',
      'moderator',
      'support_agent',
    ].includes(userRole?.toLowerCase() || '');

    if (campaign.brandId !== brandId && !isStaffOrOwner) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const submission = await this.campaignRepository.findSubmissionById(submissionId);
    if (!submission || submission.campaignId !== campaignId) {
      throw new NotFoundException('Submission not found');
    }

    // Rules for first submission (pending_approval or request_revision/revision-sent)
    if (submission.status === 'pending_approval') {
      if (decision === 'rejected') {
        throw new BadRequestException(
          'You cannot reject a draft on its first submission. You must either approve it or request a revision.',
        );
      }
    }

    // Rules for revised submission (revision-sent)
    if (submission.status === 'revision-sent') {
      if (decision === 'request_revision') {
        throw new ForbiddenException(
          `Revision has already been requested once. You must approve this revised draft or reject it to raise a dispute.`,
        );
      }
    } else {
      // If it's not pending_approval and not revision-sent, it's not in a state awaiting review
      if (submission.status !== 'pending_approval') {
        throw new ForbiddenException(`Submission is not in a state awaiting review`);
      }
    }

    // Process decision
    const updates: Record<string, unknown> = {};

    if (decision === 'approved') {
      updates.status = 'approved';
      updates.brandFeedback = null;
    } else if (decision === 'request_revision') {
      updates.status = 'request_revision';
      updates.brandFeedback = brandFeedback || 'Revision requested by brand';
    } else if (decision === 'rejected') {
      if (!brandFeedback || !brandFeedback.trim()) {
        throw new BadRequestException('A reason is required when rejecting a draft submission');
      }
      updates.status = 'disputeraised';
      updates.brandFeedback = brandFeedback;

      // Raise the dispute in the disputes table
      await this.campaignRepository.raiseDispute({
        campaignId,
        creatorId: submission.creatorId,
        brandId: campaign.brandId,
        reason: brandFeedback,
      });

      // Creator Strike Check
      const creator = await this.usersService.findOne(submission.creatorId);
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

      // Advertiser Flag Check
      const brand = await this.usersService.findOne(campaign.brandId);
      if (brand) {
        const C = await this.campaignRepository.countCampaignsByBrand(campaign.brandId);
        const D = await this.campaignRepository.countDisputedCampaignsByBrand(campaign.brandId);
        if (C >= 3 && D / C > 0.5) {
          brand.isFlagged = true;
          const rate = Math.round((D / C) * 1000) / 10;
          brand.flaggedReason = `Flagged: High dispute rate of ${rate}% (${D} disputes raised out of ${C} campaigns)`;
        } else {
          brand.isFlagged = false;
          brand.flaggedReason = null;
        }
        if (typeof brand.save === 'function') {
          await brand.save();
        }
      }
    }

    await submission.update(updates);

    const application = await this.campaignRepository.findApplicationById(submission.applicationId);
    if (application) {
      const updatedAppTimeline = this.timelineService.recordDraftVetting(
        application.timeline,
        decision,
      );
      await application.update({ timeline: updatedAppTimeline });
    }

    await this.notificationsService.notify({
      type: decision === 'approved' ? 'submission.draft_approved' : 'submission.revision_requested',
      recipientId: submission.creatorId,
      actorId: brandId,
      data: {
        campaignId,
        campaignTitle: campaign.title,
        submissionId,
        ...(decision === 'request_revision' ? { feedback: brandFeedback } : {}),
      },
    });

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async submitLivePost(
    campaignId: string,
    submissionId: string,
    creatorId: string,
    liveLink: Record<string, string>,
  ): Promise<ContentSubmission> {
    let submission = await this.campaignRepository.findSubmissionById(submissionId);

    // Dynamic support for Amplify Content campaigns which skip the draft creation phase
    if (!submission) {
      const application = await this.campaignRepository.findApplicationById(submissionId);
      if (application && application.campaignId === campaignId) {
        const campaign =
          application.campaign || (await this.campaignRepository.findById(campaignId));
        if (campaign && campaign.goal === 'Amplify Content') {
          if (application.creatorId !== creatorId) {
            throw new ForbiddenException(`You do not own this application`);
          }
          if (application.status !== 'accepted') {
            throw new ForbiddenException(
              `You can only submit live posts for accepted applications`,
            );
          }
          // Dynamically create a pre-approved ContentSubmission
          submission = await this.campaignRepository.createSubmission({
            campaignId,
            applicationId: application.id,
            creatorId,
            draftLink: campaign.amplificationAsset || '',
            status: 'approved',
          });
        }
      }
    }

    if (!submission || submission.campaignId !== campaignId) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.creatorId !== creatorId) {
      throw new ForbiddenException(`You do not own this submission`);
    }

    if (submission.status == 'livelink_available') {
      throw new ForbiddenException(`livelink already sent please wait for approval`);
    }

    if (submission.status == 'done') {
      throw new ForbiddenException(`This campaign has been completed`);
    }

    if (typeof liveLink !== 'object' || liveLink === null || Object.keys(liveLink).length === 0) {
      throw new BadRequestException(
        'liveLink must be a non-empty object of platform-to-URL mappings',
      );
    }

    // Basic URL format validation only — live-check deferred to a future integration
    for (const [platform, url] of Object.entries(liveLink)) {
      if (typeof url !== 'string') {
        throw new BadRequestException(`URL for platform "${platform}" must be a string`);
      }
      try {
        new URL(url);
      } catch {
        throw new BadRequestException(`URL for platform "${platform}" is invalid: "${url}"`);
      }
    }

    // Update submission — store the raw liveLink as submitted; urlIsLive / urlCheckedAt left null
    await submission.update({
      liveLink: liveLink,
      status: 'livelink_available',
    });

    // Notify brand
    const campaign = await this.campaignRepository.findById(campaignId);
    if (campaign) {
      await this.notificationsService.notify({
        type: 'submission.live_posted',
        recipientId: campaign.brandId,
        actorId: creatorId,
        data: { campaignId, campaignTitle: campaign.title, submissionId },
      });
    }

    // Update application timeline for live post submission
    const application = await this.campaignRepository.findApplicationById(submission.applicationId);
    if (application && typeof application.update === 'function') {
      const liveTimeline = this.timelineService.recordLivePostSubmission(application.timeline);
      await application.update({ timeline: liveTimeline });
    }

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async approveLivePost(
    campaignId: string,
    submissionId: string,
    brandId: string,
    userRole?: string,
  ): Promise<ContentSubmission> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isStaffOrOwner = [
      'owner',
      'admin',
      'superadmin',
      'super_admin',
      'finance_admin',
      'moderator',
      'support_agent',
    ].includes(userRole?.toLowerCase() || '');

    if (campaign.brandId !== brandId && !isStaffOrOwner) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const submission = await this.campaignRepository.findSubmissionById(submissionId);
    if (!submission || submission.campaignId !== campaignId) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.status !== 'livelink_available') {
      throw new ForbiddenException(`Submission live post link is not available for approval`);
    }

    // Update submission status to 'done'
    await submission.update({ status: 'done' });

    // Fetch CampaignApplication to get the fee request amount
    const application = await this.campaignRepository.findApplicationById(submission.applicationId);
    if (!application) {
      throw new NotFoundException('Campaign application not found');
    }

    // Schedule creator payout in 30 days
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + 30); // 30 days from now

    // Update application timeline for live post approval and payment release schedule
    if (typeof application?.update === 'function') {
      const approvedTimeline = this.timelineService.recordLivePostApproval(
        application.timeline,
        new Date(),
        releaseDate,
      );
      await application.update({ timeline: approvedTimeline });
    }

    // Fetch the campaign's payment record to carry the Pandascrow escrow ID
    // into the payment_release row — used by the payout cron to guard the bank transfer.
    const campaignPayment = await this.campaignRepository.findPaymentByCampaignId(campaignId);

    await this.campaignRepository.createPaymentRelease({
      campaignId,
      creatorId: submission.creatorId,
      applicationId: submission.applicationId,
      amount: application.feeRequest,
      releaseDate,
      status: 'pending',
      escrowId: campaignPayment?.escrowId ?? null,
      currency: campaign.currency,
    });

    await this.notificationsService.notify({
      type: 'submission.live_approved',
      recipientId: submission.creatorId,
      actorId: brandId,
      data: {
        campaignId,
        campaignTitle: campaign.title,
        submissionId,
        amount: application.feeRequest ?? 0,
        currency: campaign.currency,
        releaseDate: releaseDate.toDateString(),
      },
    });

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async getSubmittedContent(
    campaignId: string,
    brandId: string,
    userRole?: string,
  ): Promise<ContentSubmission[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const isStaffOrOwner = [
      'owner',
      'admin',
      'superadmin',
      'super_admin',
      'finance_admin',
      'moderator',
      'support_agent',
    ].includes(userRole?.toLowerCase() || '');

    if (campaign.brandId !== brandId && !isStaffOrOwner) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const submissions = await this.campaignRepository.findSubmissionsByCampaignId(campaignId);

    return submissions;
  }

  // ─── Fee Management Actions ────────────────────────────────────────────────

  getFees(): Promise<Fee[]> {
    return this.campaignRepository.findFees();
  }

  createFee(dto: CreateFeeDto): Promise<Fee> {
    return this.campaignRepository.createFee({
      name: dto.name,
      type: dto.type,
      value: dto.value,
    });
  }

  async deleteFee(id: string): Promise<boolean> {
    const deleted = await this.campaignRepository.deleteFee(id);
    if (!deleted) {
      throw new NotFoundException('Fee configuration not found');
    }
    return true;
  }

  // ─── Reviews & Star Ratings ────────────────────────────────────────────────

  async submitReview(dto: CreateReviewDto, brandUser: User): Promise<CampaignReview> {
    // 1. Fetch target campaign
    const campaign = await this.campaignRepository.findById(dto.campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // 2. Validate brand owner
    if (campaign.brandId !== brandUser.id) {
      throw new ForbiddenException(`You can only review creators on campaigns that you own`);
    }

    // 3. Validate campaign status is completed
    if (campaign.status !== 'completed') {
      throw new ForbiddenException(`You can only review creators after the campaign is completed`);
    }

    // 4. Validate creator was an approved participant of this campaign
    const application = await this.campaignRepository.findApplication(
      dto.campaignId,
      dto.creatorId,
    );
    if (!application || !['approved', 'accepted'].includes(application.status)) {
      throw new BadRequestException(
        `Creator with ID "${dto.creatorId}" is not an approved participant of this campaign`,
      );
    }

    // 5. Check for duplicate review
    const existingReview = await this.campaignRepository.findReviewByBrandAndCampaign(
      brandUser.id,
      dto.campaignId,
    );
    if (existingReview) {
      throw new BadRequestException(`You have already reviewed this campaign`);
    }

    // 6. Save review and update creator cached ratings in a transaction
    const t = await User.sequelize!.transaction();
    try {
      const review = await this.campaignRepository.createReview(
        {
          campaignId: dto.campaignId,
          brandId: brandUser.id,
          creatorId: dto.creatorId,
          starRating: dto.starRating,
          comment: dto.comment,
        },
        t,
      );

      const stats = await this.campaignRepository.recalculateCreatorRating(dto.creatorId, t);

      await User.update(
        { avgRating: stats.avgRating, totalReviews: stats.totalReviews },
        { where: { id: dto.creatorId }, transaction: t },
      );

      await t.commit();
      return review;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getCreatorReviews(
    creatorId: string,
    requestingUser: { id: string; role?: string | { name: string } },
  ): Promise<CampaignReview[]> {
    const roleRaw = requestingUser.role;
    const roleName =
      typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
        ? roleRaw.name
        : (roleRaw ?? '');

    // If requester is a creator, they can only view their own reviews
    if (roleName === 'creator' && requestingUser.id !== creatorId) {
      throw new ForbiddenException(`You are not authorized to view this creator's reviews`);
    }

    return this.campaignRepository.findReviewsByCreator(creatorId);
  }

  // ─── Delete Draft Campaign ─────────────────────────────────────────────────

  async deleteDraft(id: string, brandId: string): Promise<void> {
    const campaign = await this.campaignRepository.findByIdAndBrandId(id, brandId);

    if (!campaign) {
      throw new NotFoundException(`Campaign not found or you do not own it.`);
    }

    if (campaign.status !== 'draft') {
      throw new ForbiddenException(
        `Only campaigns in draft status can be permanently deleted. This campaign is currently '${campaign.status}'.`,
      );
    }

    await this.campaignRepository.deleteDraftById(id, brandId);
  }

  // ─── Activity Timeline Feed ────────────────────────────────────────────────

  async getActivityTimeline(campaignId: string): Promise<CampaignActivityTimelineResponse> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const activities: CampaignActivityItem[] = [];
    let actIndex = 1;

    const formatEventTime = (dStr: string | Date): string => {
      const date = new Date(dStr);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const month = months[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();
      let hours = date.getUTCHours();
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${month} ${day}, ${year} · ${hours}:${minutes} ${ampm}`;
    };

    // 1. Campaign created
    if (campaign.createdAt) {
      const createdDate = new Date(campaign.createdAt);
      activities.push({
        id: `act-${actIndex++}`,
        actorType: 'Brand',
        timestamp: createdDate.toISOString(),
        formattedTime: formatEventTime(createdDate),
        description: `Campaign created — ${campaign.title}`,
      });
    }

    // 2. Escrow funded
    const payment = await this.campaignRepository.findPaymentByCampaignId(campaignId);
    if (payment && (payment.paymentStatus === 'paid' || payment.escrowStatus === 'funded')) {
      const paidDate = payment.updatedAt ? new Date(payment.updatedAt) : new Date();
      const symbol = campaign.currency === 'NGN' ? '₦' : '$';
      const formattedAmount = Number(payment.totalAmount ?? payment.amount).toLocaleString('en-US');
      activities.push({
        id: `act-${actIndex++}`,
        actorType: 'Brand',
        timestamp: paidDate.toISOString(),
        formattedTime: formatEventTime(paidDate),
        description: `Escrow funded — ${symbol}${formattedAmount} secured`,
      });
    }

    // 3. Campaign published (Applications opened)
    if (campaign.approvedAt) {
      const pubDate = new Date(campaign.approvedAt);
      activities.push({
        id: `act-${actIndex++}`,
        actorType: 'System',
        timestamp: pubDate.toISOString(),
        formattedTime: formatEventTime(pubDate),
        description: 'Campaign published — Applications opened (48hr window)',
      });

      // 4. Applications closed automatically after 48h
      const now = new Date();
      const closedDate = new Date(pubDate.getTime() + 48 * 60 * 60 * 1000);
      if (
        ['reviewing_applicant', 'active', 'completed'].includes(campaign.status) ||
        now > closedDate
      ) {
        activities.push({
          id: `act-${actIndex++}`,
          actorType: 'System',
          timestamp: closedDate.toISOString(),
          formattedTime: formatEventTime(closedDate),
          description: 'Applications closed automatically after 48hrs',
        });
      }
    }

    // 5. Applications submitted by creators
    const applications =
      (await this.campaignRepository.findApplicationsByCampaignId(campaignId)) || [];
    for (const app of applications) {
      if (app.createdAt) {
        const appDate = new Date(app.createdAt);
        const creatorName = app.creator
          ? `${app.creator.firstName || ''} ${app.creator.lastName || ''}`.trim() ||
            app.creator.username ||
            'Creator'
          : 'Creator';
        const symbol = campaign.currency === 'NGN' ? '₦' : '$';
        const feeStr = `${symbol}${Number(app.feeRequest || 0).toLocaleString('en-US')}`;
        activities.push({
          id: `act-${actIndex++}`,
          actorType: 'Creator',
          timestamp: appDate.toISOString(),
          formattedTime: formatEventTime(appDate),
          description: `${creatorName} applied — fee: ${feeStr}`,
        });
      }
    }

    // 6. Creator selection completed & Declined applications
    const acceptedApps = applications.filter(
      (a) => a.status === 'accepted' || a.status === 'approved',
    );
    const declinedApps = applications.filter(
      (a) => a.status === 'rejected' || a.status === 'declined',
    );

    if (acceptedApps.length > 0) {
      let maxAcceptedDate = new Date();
      if (acceptedApps[0].updatedAt) {
        maxAcceptedDate = new Date(
          Math.max(...acceptedApps.map((a) => new Date(a.updatedAt || a.createdAt).getTime())),
        );
      }
      activities.push({
        id: `act-${actIndex++}`,
        actorType: 'Brand',
        timestamp: maxAcceptedDate.toISOString(),
        formattedTime: formatEventTime(maxAcceptedDate),
        description: `Creator selection completed — ${acceptedApps.length} creator${
          acceptedApps.length > 1 ? 's' : ''
        } chosen`,
      });

      if (declinedApps.length > 0) {
        const declinedDate = new Date(maxAcceptedDate.getTime() + 60 * 1000);
        activities.push({
          id: `act-${actIndex++}`,
          actorType: 'System',
          timestamp: declinedDate.toISOString(),
          formattedTime: formatEventTime(declinedDate),
          description: `Other ${declinedApps.length} application${
            declinedApps.length > 1 ? 's' : ''
          } automatically declined`,
        });
      }
    }

    // 7. Content Submissions
    const submissions =
      (await this.campaignRepository.findSubmissionsByCampaignId(campaignId)) || [];
    for (const sub of submissions) {
      if (sub.createdAt) {
        const subDate = new Date(sub.createdAt);
        const creatorName = sub.creator
          ? `${sub.creator.firstName || ''} ${sub.creator.lastName || ''}`.trim() || 'Creator'
          : 'Creator';
        const isLiveLink = !!sub.liveLink;
        const actionText = isLiveLink ? 'submitted live post link' : 'submitted content for review';
        activities.push({
          id: `act-${actIndex++}`,
          actorType: 'Creator',
          timestamp: subDate.toISOString(),
          formattedTime: formatEventTime(subDate),
          description: `${creatorName} ${actionText}`,
        });
      }
    }

    // Sort chronologically by timestamp
    activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      campaignId,
      totalEvents: activities.length,
      activities,
    };
  }

  async respondToComment(
    campaignId: string,
    creatorId: string,
    brandId: string,
    response: string,
  ): Promise<CampaignComment> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You do not own this campaign');
    }

    const comment = await this.campaignRepository.findCommentByCampaignAndCreator(
      campaignId,
      creatorId,
    );
    if (!comment) {
      throw new NotFoundException('No comment/question found from this creator for this campaign');
    }

    if (comment.response) {
      throw new ForbiddenException("You have already responded to this creator's comment");
    }

    await comment.update({ response });
    return comment;
  }

  // ─── Social Impact Creator Flow ──────────────────────────────────────────

  async participateInSocialImpact(
    campaignId: string,
    creatorId: string,
  ): Promise<CampaignApplication> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.type !== 'social_impact') {
      throw new BadRequestException('This campaign is not a Social Impact campaign');
    }

    const status = (campaign.status || '').toLowerCase();
    if (status === 'paused') {
      throw new ForbiddenException(
        'This Social Impact campaign is currently paused. Please check back later.',
      );
    }
    if (status !== 'active' && status !== 'live') {
      throw new ForbiddenException('This Social Impact campaign is not currently Active');
    }

    const timeline = (campaign.timeline as Record<string, any>) || {};
    const stage1 = timeline.stage1_application_window as Record<string, any> | undefined;
    const endDateRaw =
      (timeline.endDate as string | undefined) || (stage1?.endedDate as string | undefined);
    if (endDateRaw && new Date().getTime() >= new Date(endDateRaw).getTime()) {
      throw new ForbiddenException('This Social Impact campaign has reached its end date');
    }

    const creator = await this.usersService.findOne(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    // If campaign restricts eligible creator tiers, verify creator category matches
    if (campaign.creatorCategoryIds && campaign.creatorCategoryIds.length > 0) {
      const creatorCategory = creator.assignedTier
        ? await this.creatorCategoryModel.findOne({ where: { name: creator.assignedTier } })
        : null;

      if (creatorCategory && !campaign.creatorCategoryIds.includes(creatorCategory.id)) {
        throw new ForbiddenException(
          `Your tier (${creator.assignedTier}) is not eligible for this Social Impact campaign`,
        );
      }
    }

    const existingApp = await this.campaignRepository.findApplicationByCampaignAndCreator(
      campaignId,
      creatorId,
    );
    if (existingApp) {
      throw new ForbiddenException('You have already participated in this Social Impact campaign');
    }

    let primaryPlatformId = campaign.preferredPlatforms?.[0]?.id;
    if (!primaryPlatformId) {
      const allPlatforms = await this.campaignRepository.findAllPlatforms();
      primaryPlatformId = allPlatforms[0]?.id;
    }

    const application = await this.campaignRepository.createApplication({
      campaignId,
      creatorId,
      status: 'pending',
      contentIdea: 'Social Impact Campaign Participation',
      feeRequest: 0,
      primaryPlatformId,
    });

    const populated = await this.campaignRepository.findApplicationById(application.id);
    return populated || application;
  }

  async submitSocialImpactLiveLink(
    campaignId: string,
    creatorId: string,
    liveLink: string,
  ): Promise<{ submission: ContentSubmission; tokensAwarded: number }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const campaignStatus = (campaign.status || '').toLowerCase();
    if (campaignStatus === 'paused') {
      throw new ForbiddenException(
        'This Social Impact campaign is currently paused. New live link submissions are not accepted at this time.',
      );
    }

    const timeline = (campaign.timeline as Record<string, any>) || {};
    const stage1 = timeline.stage1_application_window as Record<string, any> | undefined;
    const endDateRaw =
      (timeline.endDate as string | undefined) || (stage1?.endedDate as string | undefined);
    if (endDateRaw && new Date().getTime() >= new Date(endDateRaw).getTime()) {
      throw new ForbiddenException(
        'The campaign end date has passed. New submissions are no longer accepted.',
      );
    }

    const application = await this.campaignRepository.findApplicationByCampaignAndCreator(
      campaignId,
      creatorId,
    );
    if (!application) {
      throw new NotFoundException('You have not participated in this Social Impact campaign');
    }

    const existingSubmission = await this.campaignRepository.findLatestSubmissionByApplicationId(
      application.id,
    );

    if (
      existingSubmission &&
      (existingSubmission.status === 'approved' || existingSubmission.liveLink?.link)
    ) {
      throw new ForbiddenException(
        'You have already submitted a live link for this Social Impact campaign',
      );
    }

    const submission = await this.campaignRepository.createSubmission({
      campaignId,
      applicationId: application.id,
      creatorId,
      liveLink: { link: liveLink },
      status: 'approved',
    });

    await application.update({ status: 'approved' });

    // Calculate token reward by creator tier from creator_categories table
    const creator = await this.usersService.findOne(creatorId);
    const tierName = creator?.assignedTier || 'Nano';

    const category = await this.creatorCategoryModel.findOne({
      where: { name: tierName },
    });

    let reward = category?.rewardTokens || 0;

    if (!reward) {
      const tierRewards = timeline.tierRewards as Record<string, number> | undefined;
      if (tierRewards && tierRewards[tierName]) {
        reward = Number(tierRewards[tierName]);
      } else if (campaign.tokenReward) {
        reward = Number(campaign.tokenReward);
      } else {
        if (tierName === 'Micro') reward = 3;
        else if (tierName === 'Macro') reward = 5;
        else if (tierName === 'Mega') reward = 10;
        else reward = 1;
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 12 months expiry

    await (
      this.tokenLedgerModel as unknown as { create: (data: Record<string, any>) => Promise<any> }
    ).create({
      userId: creatorId,
      campaignId: campaign.id,
      tokensAwarded: reward,
      tokensRemaining: reward,
      awardedAt: now,
      expiresAt,
      isExpired: false,
    });

    // Recalculate user token balance & badges
    const activeLedgers = await this.tokenLedgerModel.findAll({
      where: {
        userId: creatorId,
        isExpired: false,
      },
    });

    const activeTotal = activeLedgers.reduce((acc, l) => acc + (l.tokensRemaining || 0), 0);
    let badge: string | null = null;
    if (activeTotal >= 1000) badge = 'Impact Champion';
    else if (activeTotal >= 100) badge = 'Impact Leader';
    else if (activeTotal >= 10) badge = 'Impact Advocate';

    await this.userModel.update({ totalTokens: activeTotal, badge }, { where: { id: creatorId } });

    // Send Instant Push & In-App Success Notification
    await this.notificationsService.notify({
      type: 'social_impact.tokens_awarded',
      recipientId: creatorId,
      data: {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        reward,
        totalTokens: activeTotal,
      },
    });

    return { submission, tokensAwarded: reward };
  }

  async getSocialImpactCampaigns(
    query: QuerySocialImpactCampaignsDto,
  ): Promise<PaginatedResult<Campaign>> {
    const { tab = 'active', page = 1, limit = 20 } = query;
    return this.campaignRepository.findSocialImpactCampaigns(tab, page, limit);
  }

  async getMySocialImpactApplications(
    creatorId: string,
    tab: string = 'all',
  ): Promise<CampaignApplication[]> {
    const apps = await this.campaignRepository.findApplicationsByCreatorId(creatorId);

    const socialApps = apps.filter((app) => app.campaign?.type === 'social_impact');

    const creator = await this.usersService.findOne(creatorId);
    const tierName = creator?.assignedTier || 'Nano';

    let defaultReward = 1;
    if (this.creatorCategoryModel) {
      const categoryRecord = await this.creatorCategoryModel.findOne({
        where: { name: tierName },
      });
      if (categoryRecord && categoryRecord.rewardTokens) {
        defaultReward = Number(categoryRecord.rewardTokens);
      }
    }

    for (const app of socialApps) {
      const ledger = await this.tokenLedgerModel.findOne({
        where: { userId: creatorId, campaignId: app.campaignId },
      });

      const tokenReward = defaultReward;
      const tokensAwarded = ledger ? Number(ledger.tokensAwarded) : 0;

      app.setDataValue('tokenReward' as keyof CampaignApplication, tokenReward as any);
      app.setDataValue('tokensAwarded' as keyof CampaignApplication, tokensAwarded as any);
    }

    if (tab === 'pending') {
      return socialApps.filter((app) => app.status === 'pending');
    } else if (tab === 'accepted') {
      return socialApps.filter((app) => app.status === 'accepted' || app.status === 'approved');
    } else if (tab === 'rejected') {
      return socialApps.filter((app) => app.status === 'rejected');
    }

    return socialApps;
  }
}

export interface CampaignActivityItem {
  id: string;
  actorType: 'Brand' | 'System' | 'Creator' | 'Admin';
  timestamp: string;
  formattedTime: string;
  description: string;
}

export interface CampaignActivityTimelineResponse {
  campaignId: string;
  totalEvents: number;
  activities: CampaignActivityItem[];
}
