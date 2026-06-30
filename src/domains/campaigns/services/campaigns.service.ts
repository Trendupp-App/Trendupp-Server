import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Campaign } from '../entities/campaign.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Platform } from '../entities/platform.entity';
import { Payment } from '../entities/payment.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { CampaignRepository } from '../repository/campaign.repository';
import { S3Service } from '../../../integration/s3/s3.service';
import { UrlValidatorService } from '../../../integration/url-validator/url-validator.service';
import { Fee } from '../entities/fee.entity';
import { CreateFeeDto } from '../dtos/create-fee.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly s3Service: S3Service,
    private readonly urlValidatorService: UrlValidatorService,
  ) {}

  // ─── Billing Calculations ──────────────────────────────────────────────────

  async calculateBreakdown(budget: number): Promise<{
    campaignBudget: number;
    trenduppFee: number;
    vat: number;
    totalToPay: number;
    breakdownItems: { name: string; type: string; value: number; amount: number }[];
  }> {
    const fees = await this.campaignRepository.findFees();
    let trenduppFee = 0;
    let vat = 0;
    const breakdownItems: { name: string; type: string; value: number; amount: number }[] = [];

    for (const fee of fees) {
      let amount = 0;
      if (fee.type === 'percentage') {
        amount = budget * fee.value;
      } else {
        amount = fee.value;
      }
      breakdownItems.push({
        name: fee.name,
        type: fee.type,
        value: fee.value,
        amount,
      });

      const nameLower = fee.name.toLowerCase();
      if (
        nameLower.includes('fee') ||
        nameLower.includes('percentage') ||
        nameLower.includes('commission')
      ) {
        trenduppFee += amount;
      } else if (nameLower.includes('vat') || nameLower.includes('tax')) {
        vat += amount;
      }
    }

    return {
      campaignBudget: budget,
      trenduppFee,
      vat,
      totalToPay: budget + trenduppFee + vat,
      breakdownItems,
    };
  }

  async populateBreakdown(campaign: Campaign): Promise<Campaign> {
    if (campaign) {
      const breakdown = await this.calculateBreakdown(campaign.totalBudget);
      campaign.paymentBreakdown = breakdown;
    }
    return campaign;
  }

  async populateBreakdowns(campaigns: Campaign[]): Promise<Campaign[]> {
    await Promise.all(campaigns.map((c) => this.populateBreakdown(c)));
    return campaigns;
  }

  async create(
    brandId: string,
    data: {
      title: string;
      goal: string;
      totalBudget: number;
      creatorCategoryId: string;
      preferredPlatformIds: string[];
      timeline: string;
      creatorNicheId: string;
      campaignBrief?: string;
      contentGuidelines?: { dos: string[]; donts: string[] };
    },
    file?: Express.Multer.File,
  ): Promise<Campaign> {
    let coverImage: string | undefined;
    if (file) {
      coverImage = await this.s3Service.uploadFile(file);
    }

    const { preferredPlatformIds, timeline, ...campaignData } = data;

    const campaign = await this.campaignRepository.create({
      ...campaignData,
      timeline: timeline ? new Date(timeline) : undefined,
      brandId,
      coverImage,
      status: 'draft',
      currentStep: 1,
      paymentStatus: 'unpaid',
    });

    if (preferredPlatformIds && preferredPlatformIds.length > 0) {
      await campaign.$set('preferredPlatforms', preferredPlatformIds);
    }

    const populated = await this.campaignRepository.findById(campaign.id);
    return this.populateBreakdown(populated!);
  }

  async updateDraft(
    campaignId: string,
    brandId: string,
    data: {
      currentStep?: number;
      title?: string;
      goal?: string;
      totalBudget?: number;
      creatorCategoryId?: string;
      preferredPlatformIds?: string[];
      timeline?: string;
      creatorNicheId?: string;
      deliverables?: string[];
      contentDirection?: string[];
      contentGuidelines?: { dos: string[]; donts: string[] };
      usageRights?: string;
      successLooksLike?: string;
      campaignBrief?: string;
    },
    file?: Express.Multer.File,
  ): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
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
    if (file) {
      coverImage = await this.s3Service.uploadFile(file);
    }

    const { preferredPlatformIds, timeline, ...campaignData } = data;

    const updates: Record<string, unknown> = {
      ...campaignData,
    };
    if (timeline !== undefined) {
      updates.timeline = timeline ? new Date(timeline) : null;
    }
    if (file) {
      updates.coverImage = coverImage;
    }

    await campaign.update(updates);

    if (preferredPlatformIds !== undefined) {
      await campaign.$set('preferredPlatforms', preferredPlatformIds);
    }

    const populated = await this.campaignRepository.findById(campaign.id);
    return this.populateBreakdown(populated!);
  }

  async submit(
    campaignId: string,
    brandId: string,
  ): Promise<{
    campaign: Campaign;
    payment: { campaignId: string; amount: number; totalAmount: number; paymentStatus: string };
  }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    if (campaign.status !== 'draft') {
      throw new ForbiddenException(`Campaign is already submitted`);
    }

    const errors: string[] = [];
    if (!campaign.title) errors.push('title is required');
    if (!campaign.goal) errors.push('goal is required');
    if (!campaign.totalBudget) errors.push('totalBudget is required');
    if (!campaign.creatorCategoryId) errors.push('creatorCategory is required');
    if (!campaign.timeline) errors.push('timeline is required');
    if (!campaign.creatorNicheId) errors.push('creatorNiche is required');
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
    if (!campaign.successLooksLike) errors.push('successLooksLike criteria is required');
    if (!campaign.campaignBrief) errors.push('campaignBrief is required');

    if (errors.length > 0) {
      throw new ForbiddenException(`Cannot submit incomplete campaign: ${errors.join(', ')}`);
    }

    await campaign.update({
      status: 'submitted',
      currentStep: 5,
      acceptedTerms: true,
    });

    const populated = await this.campaignRepository.findById(campaign.id);
    const breakdown = await this.calculateBreakdown(populated!.totalBudget);
    populated!.paymentBreakdown = breakdown;

    return {
      campaign: populated!,
      payment: {
        campaignId: populated!.id,
        amount: populated!.totalBudget,
        totalAmount: breakdown.totalToPay,
        paymentStatus: 'unpaid',
      },
    };
  }

  async pay(
    campaignId: string,
    brandId: string,
    paymentReference?: string,
  ): Promise<{ campaign: Campaign; payment: Payment }> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const breakdown = await this.calculateBreakdown(campaign.totalBudget);

    const payment = await this.campaignRepository.createPayment({
      campaignId: campaign.id,
      amount: campaign.totalBudget,
      totalAmount: breakdown.totalToPay,
      paymentStatus: 'paid',
      paymentReference: paymentReference || `tx_${Math.random().toString(36).substring(2, 11)}`,
    });

    await campaign.update({
      paymentStatus: 'paid',
      status: 'live',
    });

    const updated = await this.campaignRepository.findById(campaign.id);
    const populated = await this.populateBreakdown(updated!);

    return {
      campaign: populated,
      payment,
    };
  }

  async findAll(status?: string): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.findAll(status);
    return this.populateBreakdowns(campaigns);
  }

  async findById(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }
    return this.populateBreakdown(campaign);
  }

  async findByBrandId(brandId: string, status?: string): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.findByBrandId(brandId, status);
    return this.populateBreakdowns(campaigns);
  }

  async findLive(): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.findLiveCampaigns();
    return this.populateBreakdowns(campaigns);
  }

  async findPast(): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.findPastCampaigns();
    return this.populateBreakdowns(campaigns);
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
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
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
      pastWorkLink?: string;
      primaryPlatformId: string;
      secondaryPlatformId?: string;
      feeRequest: number;
      comments?: string;
    },
  ): Promise<CampaignApplication> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.status !== 'live') {
      throw new ForbiddenException(`You can only apply to live campaigns`);
    }

    const existingApp = await this.campaignRepository.findApplication(campaignId, creatorId);
    if (existingApp) {
      throw new ForbiddenException(`You have already applied to this campaign`);
    }

    const application = await this.campaignRepository.createApplication({
      campaignId,
      creatorId,
      ...data,
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
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    return this.campaignRepository.findApplicationsByCampaignId(campaignId);
  }

  async reviewCampaignApplication(
    campaignId: string,
    appId: string,
    brandId: string,
    status: string,
  ): Promise<CampaignApplication> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const application = await this.campaignRepository.findApplicationById(appId);
    if (!application || application.campaignId !== campaignId) {
      throw new NotFoundException(`Application with ID "${appId}" not found for this campaign`);
    }

    await application.update({ status });
    const updated = await this.campaignRepository.findApplicationById(appId);
    if (updated && updated.campaign) {
      await this.populateBreakdown(updated.campaign);
    }
    return updated!;
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

  // ─── Content Submissions Flow ─────────────────────────────────────────────

  async submitDraft(
    campaignId: string,
    applicationId: string,
    creatorId: string,
    draftLink: string,
  ): Promise<ContentSubmission> {
    const application = await this.campaignRepository.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundException(`Application with ID "${applicationId}" not found`);
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
          `You cannot submit a new draft. Revision has already been sent or approved.`,
        );
      }
      // Re-submission / Revision
      await previousSub.update({
        draftLink,
        status: 'revision-sent',
        brandFeedback: null,
      });
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
      const populated = await this.campaignRepository.findSubmissionById(submission.id);
      return populated!;
    }
  }

  async vetDraft(
    campaignId: string,
    submissionId: string,
    brandId: string,
    decision: 'approved' | 'request_revision',
    brandFeedback?: string,
  ): Promise<ContentSubmission> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const submission = await this.campaignRepository.findSubmissionById(submissionId);
    if (!submission || submission.campaignId !== campaignId) {
      throw new NotFoundException(
        `Submission with ID "${submissionId}" not found for this campaign`,
      );
    }

    if (submission.status !== 'pending_approval' && submission.status !== 'revision-sent') {
      throw new ForbiddenException(`Submission is not in a state awaiting review`);
    }

    if (decision === 'request_revision' && submission.status === 'revision-sent') {
      throw new ForbiddenException(
        `Revision has already been requested once. You must approve this revised draft.`,
      );
    }

    const updates: Record<string, unknown> = { status: decision };
    if (decision === 'request_revision') {
      updates.brandFeedback = brandFeedback || 'Revision requested by brand';
    } else {
      updates.brandFeedback = null;
    }

    await submission.update(updates);
    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async submitLivePost(
    campaignId: string,
    submissionId: string,
    creatorId: string,
    liveLink: string,
  ): Promise<ContentSubmission> {
    const submission = await this.campaignRepository.findSubmissionById(submissionId);
    if (!submission || submission.campaignId !== campaignId) {
      throw new NotFoundException(
        `Submission with ID "${submissionId}" not found for this campaign`,
      );
    }

    if (submission.creatorId !== creatorId) {
      throw new ForbiddenException(`You do not own this submission`);
    }

    if (submission.status !== 'approved') {
      throw new ForbiddenException(`You can only submit proof of posting for approved drafts`);
    }

    // Run Tier 1 url check
    const { isLive, checkedAt } = await this.urlValidatorService.validateUrl(liveLink);

    // Update submission
    await submission.update({
      liveLink,
      urlIsLive: isLive,
      urlCheckedAt: checkedAt,
      status: 'done',
    });

    // Update campaign level convenience status
    const campaign = await this.campaignRepository.findById(campaignId);
    if (campaign) {
      await campaign.update({ urlIsLive: isLive });
    }

    // Update application status to approved
    const application = await this.campaignRepository.findApplicationById(submission.applicationId);
    if (application) {
      await application.update({ status: 'approved' });
    }

    const updated = await this.campaignRepository.findSubmissionById(submissionId);
    return updated!;
  }

  async getSubmittedContent(campaignId: string, brandId: string): Promise<ContentSubmission[]> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(`You do not own this campaign`);
    }

    const submissions = await this.campaignRepository.findSubmissionsByCampaignId(campaignId);

    // Re-validate completed live links in background
    const liveSubs = submissions.filter((s) => s.status === 'done' && s.liveLink);
    if (liveSubs.length > 0) {
      const results = await Promise.allSettled(
        liveSubs.map(async (sub) => {
          const { isLive, checkedAt } = await this.urlValidatorService.validateUrl(sub.liveLink!);
          await sub.update({
            urlIsLive: isLive,
            urlCheckedAt: checkedAt,
          });
          return { id: sub.id, isLive };
        }),
      );

      // Update campaign level convenience status using the most recent submission's liveness check
      const latestSub = liveSubs[0]; // Ordered by createdAt DESC
      if (latestSub) {
        const latestResult = results[0];
        if (latestResult && latestResult.status === 'fulfilled') {
          await campaign.update({ urlIsLive: latestResult.value.isLive });
        }
      }
    }

    // Refresh and return latest
    return this.campaignRepository.findSubmissionsByCampaignId(campaignId);
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
      throw new NotFoundException(`Fee configuration with ID "${id}" not found`);
    }
    return true;
  }
}
