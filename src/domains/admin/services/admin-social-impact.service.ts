import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { ContentSubmission } from '../../campaigns/entities/content-submission.entity';
import { TokenBatch } from '../entities/token-batch.entity';
import { CreatorCategory } from '../../campaigns/entities/creator-category.entity';
import { UserTokenLedger } from '../../users/entities/user-token-ledger.entity';
import { AuditLogService } from './audit-log.service';
import {
  TokenBatchResponseDto,
  AdminSocialImpactSummaryResponseDto,
  QueryAdminSocialImpactListDto,
  SocialImpactCampaignsListResponseDto,
  SocialImpactCampaignListItemDto,
  CreateSocialImpactCampaignDto,
  UpdateSocialImpactCampaignDto,
  SocialImpactCampaignDetailDto,
  QuerySocialImpactParticipantsDto,
  SocialImpactParticipantsListResponseDto,
  SocialImpactParticipantItemDto,
  ReviewParticipantSubmissionDto,
  SocialImpactAdminActionDto,
} from '../dtos/admin-social-impact.dto';

@Injectable()
export class AdminSocialImpactService {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(ContentSubmission)
    private readonly submissionModel: typeof ContentSubmission,
    @InjectModel(TokenBatch)
    private readonly tokenBatchModel: typeof TokenBatch,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(UserTokenLedger)
    private readonly tokenLedgerModel: typeof UserTokenLedger,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ── 1. Token Batches Lookup ────────────────────────────────────────────────

  async getTokenBatches(): Promise<TokenBatchResponseDto[]> {
    const batches = await this.tokenBatchModel.findAll({
      where: { isActive: true },
      order: [['amount', 'ASC']],
    });

    return batches.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      description: b.description || null,
    }));
  }

  // ── 2. Summary KPI Cards ───────────────────────────────────────────────────

  async getSocialImpactSummary(): Promise<AdminSocialImpactSummaryResponseDto> {
    const campaigns = await this.campaignModel.findAll({
      where: { type: 'social_impact' } as unknown as Record<string, unknown>,
      include: [
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id', 'status'],
        },
      ],
    });

    let activeSocialCampaigns = 0;
    let totalParticipations = 0;
    let tokensDistributed = 0;
    let campaignsCompleted = 0;

    for (const c of campaigns) {
      const st = (c.status || '').toLowerCase();
      const reward = Number(c.tokenReward || 100);
      const apps = c.applications || [];

      totalParticipations += apps.length;

      if (st === 'live' || st === 'active') {
        activeSocialCampaigns++;
      } else if (st === 'completed') {
        campaignsCompleted++;
      }

      // Sum tokens for approved applications
      const approvedApps = apps.filter(
        (a) =>
          (a.status || '').toLowerCase() === 'accepted' ||
          (a.status || '').toLowerCase() === 'approved',
      );
      tokensDistributed += approvedApps.length * reward;
    }

    return {
      activeSocialCampaigns,
      totalParticipations,
      tokensDistributed,
      campaignsCompleted,
    };
  }

  // ── 3. Social Impact Campaigns List ───────────────────────────────────────

  async getSocialImpactList(
    query: QueryAdminSocialImpactListDto,
  ): Promise<SocialImpactCampaignsListResponseDto> {
    const { q, tab = 'all', page = 1, limit = 20 } = query;

    const where: Record<string | symbol, unknown> = { type: 'social_impact' };

    // Tab Filter
    if (tab === 'draft') {
      where.status = 'draft';
    } else if (tab === 'live') {
      where.status = 'live';
    } else if (tab === 'active') {
      where.status = 'active';
    } else if (tab === 'completed') {
      where.status = 'completed';
    }

    // Search Query Filter
    if (q) {
      const pattern = `%${q.trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: pattern } },
        Sequelize.where(Sequelize.cast(Sequelize.col('Campaign.id'), 'varchar'), {
          [Op.iLike]: pattern,
        }),
      ];
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await this.campaignModel.findAndCountAll({
      where: where as unknown as Record<string, unknown>,
      limit,
      offset,
      order: [['updatedAt', 'DESC']],
      distinct: true,
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'avatarUrl'],
        },
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id'],
        },
      ],
    });

    const data: SocialImpactCampaignListItemDto[] = rows.map((c, idx) => {
      const shortNum = (offset + idx + 1001).toString();
      const displayId = `TRD-${shortNum}`;

      const brandObj = c.brand;
      const brandName = brandObj
        ? `${brandObj.firstName || ''} ${brandObj.lastName || ''}`.trim() ||
          brandObj.username ||
          'Trendupp'
        : 'Trendupp';

      const appsCount = c.applications ? c.applications.length : 0;
      const step = c.currentStep || 1;
      const sectionsCompleted = `${step}/5 sections`;

      // Timeline difference for days left
      const timelineObj = c.timeline as Record<string, { endedDate?: string }> | null | undefined;
      const endedDateStr = timelineObj?.stage1_application_window?.endedDate;
      let daysLeft = 4;
      if (endedDateStr) {
        const diffMs = new Date(endedDateStr).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        id: c.id,
        displayId,
        title: c.title,
        coverImageUrl: c.coverImageUrl || c.coverImage || null,
        brand: {
          id: c.brandId,
          name: brandName,
          logoUrl: brandObj?.avatarUrl || null,
        },
        category: 'Food & Lifestyle',
        tokenReward: Number(c.tokenReward || 100),
        appliedCount: appsCount,
        daysLeft,
        status: (c.status || 'DRAFT').toUpperCase(),
        sectionsCompleted,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
    });

    const totalPages = Math.ceil(count / limit);

    return {
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  // ── 4. Create Social Impact Campaign ───────────────────────────────────────

  async createSocialImpactCampaign(
    dto: CreateSocialImpactCampaignDto,
    adminId: string,
  ): Promise<Campaign> {
    const brand = await this.userModel.findByPk(dto.brandId);
    if (!brand) {
      throw new NotFoundException('Selected Advertiser brand not found');
    }

    const isDraft = dto.isDraft !== false;
    const status = isDraft ? 'draft' : 'live';

    const contentGuidelines = {
      dos: dto.dos || [],
      donts: dto.donts || [],
    };

    const campaign = await this.campaignModel.create({
      title: dto.title,
      goal: dto.goal,
      brandId: dto.brandId,
      type: 'social_impact',
      tokenReward: dto.tokenReward,
      currentStep: dto.currentStep || 1,
      status,
      paymentStatus: 'paid',
      coverImageUrl: dto.coverImageUrl,
      campaignBrief: dto.campaignBrief,
      deliverables: dto.deliverables || [],
      contentDirection: dto.contentDirection || [],
      contentGuidelines,
    } as unknown as Campaign);

    await this.auditLogService.log({
      adminId,
      action: isDraft ? 'CREATE_SOCIAL_IMPACT_DRAFT' : 'PUBLISH_SOCIAL_IMPACT',
      details: { campaignId: campaign.id, title: dto.title, tokenReward: dto.tokenReward },
    });

    return campaign;
  }

  // ── 5. Update Social Impact Campaign ───────────────────────────────────────

  async updateSocialImpactCampaign(
    id: string,
    dto: UpdateSocialImpactCampaignDto,
    adminId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) {
      throw new NotFoundException('Social Impact campaign not found');
    }

    const updates: Partial<Campaign> = {};

    if (dto.title) updates.title = dto.title;
    if (dto.goal) updates.goal = dto.goal;
    if (dto.brandId) updates.brandId = dto.brandId;
    if (dto.tokenReward) updates.tokenReward = dto.tokenReward;
    if (dto.coverImageUrl) updates.coverImageUrl = dto.coverImageUrl;
    if (dto.campaignBrief) updates.campaignBrief = dto.campaignBrief;
    if (dto.currentStep) updates.currentStep = dto.currentStep;
    if (dto.deliverables) updates.deliverables = dto.deliverables;
    if (dto.contentDirection) updates.contentDirection = dto.contentDirection;

    if (dto.dos || dto.donts) {
      const existing = campaign.contentGuidelines || { dos: [], donts: [] };
      updates.contentGuidelines = {
        dos: dto.dos || existing.dos || [],
        donts: dto.donts || existing.donts || [],
      };
    }

    await campaign.update(updates);

    await this.auditLogService.log({
      adminId,
      action: 'UPDATE_SOCIAL_IMPACT',
      details: { campaignId: campaign.id, ...updates },
    });

    return campaign;
  }

  // ── 6. Publish Social Impact Campaign ──────────────────────────────────────

  async publishSocialImpactCampaign(id: string, adminId: string): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) {
      throw new NotFoundException('Social Impact campaign not found');
    }

    await campaign.update({ status: 'live', currentStep: 3 });

    await this.auditLogService.log({
      adminId,
      action: 'PUBLISH_SOCIAL_IMPACT',
      details: { campaignId: campaign.id, title: campaign.title },
    });

    return campaign;
  }

  // ── 7. Delete Social Impact Campaign ───────────────────────────────────────

  async deleteSocialImpactCampaign(id: string, adminId: string): Promise<{ success: boolean }> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) {
      throw new NotFoundException('Social Impact campaign not found');
    }

    await campaign.destroy();

    await this.auditLogService.log({
      adminId,
      action: 'DELETE_SOCIAL_IMPACT',
      details: { campaignId: id, title: campaign.title },
    });

    return { success: true };
  }

  // ── 8. Social Impact Details View ──────────────────────────────────────────

  async getSocialImpactDetails(id: string): Promise<SocialImpactCampaignDetailDto> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl'],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Social Impact campaign not found');
    }

    const brandObj = campaign.brand;
    const brandName = brandObj
      ? `${brandObj.firstName || ''} ${brandObj.lastName || ''}`.trim() ||
        brandObj.username ||
        'Trendupp'
      : 'Trendupp';

    const guidelines = campaign.contentGuidelines || { dos: [], donts: [] };

    return {
      id: campaign.id,
      displayId: `TRD-${campaign.id.substring(0, 4).toUpperCase()}`,
      title: campaign.title,
      status: (campaign.status || 'LIVE').toUpperCase(),
      tokenReward: Number(campaign.tokenReward || 100),
      brand: {
        id: campaign.brandId,
        name: brandName,
        logoUrl: brandObj?.avatarUrl || null,
      },
      coverImageUrl: campaign.coverImageUrl || campaign.coverImage || null,
      info: {
        goal: campaign.goal || 'Create Content',
        niche: 'Fashion',
        creatorTiers: ['Micro', 'Nano'],
        preferredPlatforms: ['Instagram'],
        createdAt: campaign.createdAt,
      },
      campaignBrief: campaign.campaignBrief || 'Social Impact Initiative created by Trendupp.',
      deliverables: (campaign.deliverables as unknown as string[]) || [
        '1x Instagram Reel (30-60 seconds)',
      ],
      contentDirection: (campaign.contentDirection as unknown as string[]) || [
        'Film in warm, golden-hour lighting',
      ],
      guidelines: {
        dos: guidelines.dos || ['Tag brand account'],
        donts: guidelines.donts || ['No competitor brands visible'],
      },
      successLooksLike: 'We are looking for content that feels authentic and visually appealing.',
      usageRights: 'Creators grant permission to repost and use campaign content across platforms.',
    };
  }

  // ── 9. Creator Participants Tab Listing ───────────────────────────────────

  async getParticipants(
    id: string,
    query: QuerySocialImpactParticipantsDto,
  ): Promise<SocialImpactParticipantsListResponseDto> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) {
      throw new NotFoundException('Social Impact campaign not found');
    }

    const { status = 'all', page = 1, limit = 20 } = query;

    const offset = (page - 1) * limit;

    const { rows, count } = await this.applicationModel.findAndCountAll({
      where: { campaignId: id },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl'],
        },
        {
          model: ContentSubmission,
          as: 'submissions',
        },
      ],
    });

    const data: SocialImpactParticipantItemDto[] = rows.map((app) => {
      const creatorObj = app.creator;
      const creatorName =
        (creatorObj
          ? `${creatorObj.firstName || ''} ${creatorObj.lastName || ''}`.trim() ||
            creatorObj.username
          : '') || 'Creator';

      const latestSub = app.submissions && app.submissions.length > 0 ? app.submissions[0] : null;

      let subStatus = 'no_submission';
      if (latestSub) {
        if (latestSub.status === 'approved') {
          subStatus = 'approved';
        } else if (latestSub.status === 'rejected') {
          subStatus = 'rejected';
        } else {
          subStatus = 'pending_review';
        }
      }

      // Content Link string extracted from draftLink or liveLink Record
      let contentLinkStr: string | null = null;
      if (latestSub?.draftLink) {
        contentLinkStr = latestSub.draftLink;
      } else if (latestSub?.liveLink && typeof latestSub.liveLink === 'object') {
        const values = Object.values(latestSub.liveLink);
        if (values.length > 0) contentLinkStr = values[0];
      }

      return {
        applicationId: app.id,
        creator: {
          id: app.creatorId,
          name: creatorName,
          username: creatorObj?.username ? `@${creatorObj.username}` : '@creator',
          avatarUrl: creatorObj?.avatarUrl || null,
          rating: 4.9,
          tier: 'Micro',
          followers: '180K',
          engagementRate: '5.2%',
        },
        tokenReward: Number(campaign.tokenReward || 100),
        contentLink: contentLinkStr,
        status: subStatus,
        submittedAt: latestSub?.createdAt ? latestSub.createdAt : null,
      };
    });

    // Client tab filter if specified
    let filteredData = data;
    if (status !== 'all') {
      filteredData = data.filter((item) => item.status === status);
    }

    const totalPages = Math.ceil(count / limit);

    return {
      data: filteredData,
      meta: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  // ── 10. Approve Participant Submission & Award Tokens ──────────────────────

  async approveParticipant(
    campaignId: string,
    appId: string,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const application = await this.applicationModel.findOne({
      where: { id: appId, campaignId },
      include: [{ model: Campaign, as: 'campaign' }],
    });
    if (!application) {
      throw new NotFoundException('Participant application not found');
    }

    await application.update({ status: 'accepted' });

    const submission = await this.submissionModel.findOne({
      where: { applicationId: appId },
      order: [['createdAt', 'DESC']],
    });

    if (submission) {
      await submission.update({ status: 'approved' });
    }

    // Award tokens to creator based on their CreatorCategory and recalculate badge
    const creator = await this.userModel.findByPk(application.creatorId);
    let awardedTokens = 0;
    if (creator) {
      const maxFollowers = Math.max(
        creator.instagramFollowers || 0,
        creator.tiktokFollowers || 0,
        creator.youtubeFollowers || 0,
        creator.twitterFollowers || 0,
        creator.facebookFollowers || 0,
      );

      const categories = await this.creatorCategoryModel.findAll({
        order: [['minFollowers', 'DESC']],
      });
      const matchedCat =
        categories.find(
          (c) =>
            maxFollowers >= c.minFollowers && (!c.maxFollowers || maxFollowers <= c.maxFollowers),
        ) || (categories.length > 0 ? categories[categories.length - 1] : null);

      awardedTokens = matchedCat?.rewardTokens ?? Number(application.campaign?.tokenReward || 1);

      const awardedAt = new Date();
      const expiresAt = new Date(awardedAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await this.tokenLedgerModel.create({
        userId: creator.id,
        campaignId,
        tokensAwarded: awardedTokens,
        tokensRemaining: awardedTokens,
        awardedAt,
        expiresAt,
        isExpired: false,
      } as unknown as UserTokenLedger);

      const activeLedgers = await this.tokenLedgerModel.findAll({
        where: {
          userId: creator.id,
          isExpired: false,
        },
      });

      const totalTokens = activeLedgers.reduce((acc, l) => acc + (l.tokensRemaining || 0), 0);

      let badge: string | null = null;
      if (totalTokens >= 1000) {
        badge = 'Impact Champion';
      } else if (totalTokens >= 100) {
        badge = 'Impact Leader';
      } else if (totalTokens >= 10) {
        badge = 'Impact Advocate';
      }

      await creator.update({
        totalTokens,
        badge,
      });
    }

    await this.auditLogService.log({
      adminId,
      action: 'APPROVE_SOCIAL_IMPACT_PARTICIPANT',
      targetUserId: application.creatorId,
      details: {
        campaignId,
        applicationId: appId,
        awardedTokens,
        reason: 'Approved content and awarded tokens',
      },
    });

    return {
      success: true,
      message: `Participant submission approved and ${awardedTokens} tokens awarded successfully.`,
    };
  }

  // ── 11. Reject Participant Submission ───────────────────────────────────────

  async rejectParticipant(
    campaignId: string,
    appId: string,
    dto: ReviewParticipantSubmissionDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const application = await this.applicationModel.findOne({
      where: { id: appId, campaignId },
    });
    if (!application) {
      throw new NotFoundException('Participant application not found');
    }

    await application.update({ status: 'rejected' });

    const submission = await this.submissionModel.findOne({
      where: { applicationId: appId },
      order: [['createdAt', 'DESC']],
    });

    if (submission) {
      await submission.update({
        status: 'rejected',
        brandFeedback: dto.reason || 'Content rejected by admin',
      });
    }

    await this.auditLogService.log({
      adminId,
      action: 'REJECT_SOCIAL_IMPACT_PARTICIPANT',
      targetUserId: application.creatorId,
      details: { campaignId, applicationId: appId, reason: dto.reason || 'Content rejected' },
    });

    return {
      success: true,
      message: 'Participant submission rejected.',
    };
  }

  // ── 12. Administrative Actions ─────────────────────────────────────────────

  async pauseCampaign(
    id: string,
    dto: SocialImpactAdminActionDto,
    adminId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) throw new NotFoundException('Social Impact campaign not found');

    await campaign.update({ status: 'paused' });

    await this.auditLogService.log({
      adminId,
      action: 'PAUSE_SOCIAL_IMPACT',
      details: { campaignId: id, reason: dto.reason },
    });

    return campaign;
  }

  async cancelCampaign(
    id: string,
    dto: SocialImpactAdminActionDto,
    adminId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) throw new NotFoundException('Social Impact campaign not found');

    await campaign.update({ status: 'cancelled' });

    await this.auditLogService.log({
      adminId,
      action: 'CANCEL_SOCIAL_IMPACT',
      details: { campaignId: id, reason: dto.reason },
    });

    return campaign;
  }

  async extendDeadline(
    id: string,
    dto: SocialImpactAdminActionDto,
    adminId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) throw new NotFoundException('Social Impact campaign not found');

    if (!dto.newDeadline) {
      throw new BadRequestException('newDeadline parameter is required to extend deadline');
    }

    const newEndIso = new Date(dto.newDeadline).toISOString();
    const updatedTimeline =
      (campaign.timeline as Record<string, Record<string, string>> | null) || {};
    if (updatedTimeline.stage1_application_window) {
      updatedTimeline.stage1_application_window.endedDate = newEndIso;
    }
    await campaign.update({ timeline: updatedTimeline });

    await this.auditLogService.log({
      adminId,
      action: 'EXTEND_SOCIAL_IMPACT_DEADLINE',
      details: { campaignId: id, reason: dto.reason, newDeadline: dto.newDeadline },
    });

    return campaign;
  }

  async closeApplications(
    id: string,
    dto: SocialImpactAdminActionDto,
    adminId: string,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id, type: 'social_impact' } as unknown as Record<string, unknown>,
    });
    if (!campaign) throw new NotFoundException('Social Impact campaign not found');

    await campaign.update({ status: 'active' });

    await this.auditLogService.log({
      adminId,
      action: 'CLOSE_SOCIAL_IMPACT_APPLICATIONS',
      details: { campaignId: id, reason: dto.reason },
    });

    return campaign;
  }
}
