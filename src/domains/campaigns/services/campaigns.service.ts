import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../../integration/email/email.service';
import { Niche } from '../../users/entities/niche.entity';
import { Op } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly s3Service: S3Service,
    private readonly usersService: UsersService,
    private readonly pandascrowService: PandascrowService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(Fee)
    private readonly feeModel: typeof Fee,
  ) {}

  // ─── Billing Calculations ──────────────────────────────────────────────────

  async calculateBreakdown(
    budget: number,
    currency: string,
  ): Promise<{
    campaignBudget: number;
    trenduppFee: number;
    vat: number;
    pandascrowFee: number;
    totalToPay: number;
    breakdownItems: { name: string; type: string; value: number; amount: number }[];
  }> {
    // Trendupp commission (15%) and VAT (7.5%) are deducted from the brand's total payment
    const trenduppFee = Math.round(budget * 0.15);
    const vat = Math.round(budget * 0.075);

    // Look up Pandascrow platform fee rate from the fees table
    // NGN → Pandascrow routes via Paystack (3%), USD → via Stripe (5%)
    const feeKey =
      currency === 'NGN' ? 'Pandascrow Gateway Fee (NGN)' : 'Pandascrow Gateway Fee (USD)';
    const feeRecord = await this.feeModel.findOne({ where: { name: feeKey } });
    const pandascrowRate = feeRecord?.value ?? (currency === 'NGN' ? 0.03 : 0.05); // safe fallback
    const pandascrowFee = Math.round(budget * pandascrowRate);

    // Creator pool = total paid − Trendupp fee − VAT − Pandascrow platform fee
    const campaignBudget = budget - trenduppFee - vat - pandascrowFee;

    const breakdownItems: { name: string; type: string; value: number; amount: number }[] = [
      {
        name: 'Trendupp Fee',
        type: 'percentage',
        value: 0.15,
        amount: trenduppFee,
      },
      {
        name: 'VAT',
        type: 'percentage',
        value: 0.075,
        amount: vat,
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
      breakdownItems,
    };
  }

  async populateBreakdown(campaign: Campaign, requestingUserId?: string): Promise<Campaign> {
    if (campaign) {
      const breakdown = await this.calculateBreakdown(
        campaign.totalBudget,
        campaign.currency ?? 'USD',
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
      timeline: string;
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
      timeline: timeline ? new Date(timeline) : undefined,
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
      if (!campaign.timeline) errors.push('timeline is required');
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
      if (!campaign.usageRights) errors.push('usageRights text is required');
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

    // Load brand profile details
    const brand = await this.usersService.findOne(brandId);
    if (!brand) {
      throw new NotFoundException('Brand user profile not found');
    }

    const breakdown = await this.calculateBreakdown(campaign.totalBudget, campaign.currency);

    // Initialize escrow on Pandascrow
    const deliveryDateStr = new Date(campaign.timeline!).toISOString().split('T')[0];
    const escrow = await this.pandascrowService.initializeEscrow({
      title: campaign.title,
      description: campaign.campaignBrief!,
      amount: breakdown.totalToPay,
      currency: campaign.currency, // Nigeria -> NGN, other countries -> USD
      deliveryDate: deliveryDateStr,
      buyerDetails: {
        name: `${brand.firstName} ${brand.lastName}`,
        email: 'finance@trendupp.com', //brand.email,
        phone: '+2347068168809', //brand.phoneNumber || '',
      },
      sellerDetails: {
        name: 'Trendupp Platform',
        email: 'app@trendupp.com', //if the email is app@trendup it would default to the default email which is "app@trnedp" but if you change it that email would recieve the email
        phone: '+2347068168809',
      },
    });

    await campaign.update({
      status: 'pending_payment',
      currentStep: 5,
      acceptedTerms: true,
      paymentStatus: 'pending',
    });

    // Create pending payment record
    // gatewayFee = Pandascrow platform fee already computed inside calculateBreakdown
    // (3% for NGN/Paystack, 5% for USD/Stripe)
    const payment = await this.campaignRepository.createPayment({
      campaignId: campaign.id,
      amount: breakdown.campaignBudget,
      totalAmount: breakdown.totalToPay,
      gatewayFee: breakdown.pandascrowFee,
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

      const isAdmin = ['admin', 'superadmin', 'finance_admin'].includes(role);
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
    // ─────────────────────────────────────────────────────────────────────────

    const existingApp = await this.campaignRepository.findApplication(campaignId, creatorId);
    if (existingApp) {
      throw new ForbiddenException(`You have already applied to this campaign`);
    }

    const application = await this.campaignRepository.createApplication({
      campaignId,
      creatorId,
      ...data,
    });

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
    if (populated && populated.campaign) {
      await this.populateBreakdown(populated.campaign);
    }
    return populated!;
  }

  async getCampaignApplications(
    campaignId: string,
    brandId: string,
  ): Promise<CampaignApplication[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    return this.campaignRepository.findApplicationsByCampaignId(campaignId);
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
    await application.update({ status });

    // When a brand accepts an application, promote the campaign to active
    if (status === 'accepted') {
      await campaign.update({ status: 'active' });
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
        await application.update({ status });

        // When a brand accepts an application, promote the campaign to active
        if (status === 'accepted') {
          await campaign.update({ status: 'active' });
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
      return application;
    }

    if (role === 'creator') {
      if (application.creatorId !== userId) {
        throw new ForbiddenException(`You do not own this application`);
      }
      if (application.campaign) {
        await this.populateBreakdown(application.campaign);
      }
      return application;
    }

    if (role === 'brand') {
      if (application.campaign?.brandId !== userId) {
        throw new ForbiddenException(`You do not own the campaign for this application`);
      }
      await this.populateBreakdown(application.campaign);
      return application;
    }

    throw new ForbiddenException(`Unauthorized access`);
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
  ): Promise<ContentSubmission> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
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

    // Update application status to approved
    // const application = await this.campaignRepository.findApplicationById(submission.applicationId);
    // if (application) {
    //   await application.update({ status: 'approved' });
    // }

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async approveLivePost(
    campaignId: string,
    submissionId: string,
    brandId: string,
  ): Promise<ContentSubmission> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
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
        amount: application.feeRequest,
        currency: campaign.currency,
        releaseDate: releaseDate.toDateString(),
      },
    });

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async getSubmittedContent(campaignId: string, brandId: string): Promise<ContentSubmission[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
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
}
