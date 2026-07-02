import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes, Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Campaign } from '../entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Platform } from '../entities/platform.entity';
import { Payment } from '../entities/payment.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { Niche } from '../../users/entities/niche.entity';
import { Fee } from '../entities/fee.entity';
import { CampaignReview } from '../entities/campaign-review.entity';
import { FindAllCampaignsQueryDto } from '../dtos/find-all-campaigns-query.dto';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class CampaignRepository {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(Platform)
    private readonly platformModel: typeof Platform,
    @InjectModel(Payment)
    private readonly paymentModel: typeof Payment,
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(ContentSubmission)
    private readonly contentSubmissionModel: typeof ContentSubmission,
    @InjectModel(Fee)
    private readonly feeModel: typeof Fee,
    @InjectModel(CampaignReview)
    private readonly campaignReviewModel: typeof CampaignReview,
  ) {}

  private readonly fullIncludes = [
    {
      model: User,
      as: 'brand',
      attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
    },
    {
      model: CreatorCategory,
      as: 'creatorCategory',
    },
    {
      model: Platform,
      as: 'preferredPlatforms',
    },
    {
      model: Niche,
      as: 'creatorNiche',
    },
  ];

  create(data: Partial<Attributes<Campaign>>): Promise<Campaign> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.campaignModel as any).create(data) as Promise<Campaign>;
  }

  async findById(id: string): Promise<Campaign | null> {
    const campaign = await this.campaignModel.findByPk(id, {
      include: [
        ...this.fullIncludes,
        {
          model: CampaignApplication,
          as: 'applications',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: [
                'id',
                'firstName',
                'lastName',
                'email',
                'username',
                'avatarUrl',
                'assignedTier',
                'instagramUsername',
                'instagramFollowers',
                'tiktokUsername',
                'tiktokFollowers',
                'youtubeUsername',
                'youtubeFollowers',
                'twitterUsername',
                'twitterFollowers',
              ],
            },
            { model: Platform, as: 'primaryPlatform' },
            { model: Platform, as: 'secondaryPlatform' },
          ],
        },
      ],
    });

    if (campaign && campaign.status === 'deleted') {
      return null;
    }
    return campaign;
  }

  findAll(query: FindAllCampaignsQueryDto): Promise<PaginatedResult<Campaign>> {
    const { status, sortBy, platforms, niches, nicheIds, goal, page = 1, limit = 10 } = query;

    const where: Record<string, unknown> = {};

    // 1. Filter by Status
    if (status) {
      if (status === 'past') {
        where['status'] = { [Op.in]: ['completed', 'cancelled'] };
      } else {
        where['status'] = status;
      }
    } else {
      where['status'] = { [Op.ne]: 'deleted' };
    }

    // 2. Filter by Platforms
    if (platforms && platforms.length > 0) {
      const platformNames = platforms.map((p) => {
        const trimmed = p.trim();
        return trimmed.toLowerCase() === 'x' ? 'Twitter' : trimmed;
      });
      where['$preferredPlatforms.name$'] = {
        [Op.or]: platformNames.map((name) => ({ [Op.iLike]: name })),
      };
    }

    // 3. Filter by Niches / Niche IDs
    if (nicheIds && nicheIds.length > 0) {
      where['creatorNicheId'] = { [Op.in]: nicheIds };
    } else if (niches && niches.length > 0) {
      where['$creatorNiche.name$'] = {
        [Op.or]: niches.map((name) => ({ [Op.iLike]: name })),
      };
    }

    // 4. Filter by Campaign Goal
    if (goal) {
      let targetGoal = goal;
      if (goal.toLowerCase() === 'content creation') {
        targetGoal = 'Create Content';
      } else if (goal.toLowerCase() === 'amplification') {
        targetGoal = 'Amplify Content';
      }
      where['goal'] = targetGoal;
    }

    // 5. Determine Order Sort Criteria
    let order: Array<[string, string]> = [['createdAt', 'DESC']]; // default newest
    if (sortBy) {
      if (sortBy === 'highest_budget') {
        order = [['totalBudget', 'DESC']];
      } else if (sortBy === 'closing_soon') {
        order = [['timeline', 'ASC']];
      }
    }

    return paginate(
      this.campaignModel,
      {
        where,
        include: this.fullIncludes,
        order,
        distinct: true,
        subQuery: false,
      },
      { page, limit },
    );
  }

  /**
   * Campaigns owned by a specific brand user.
   */
  findByBrandId(brandId: string, status?: string): Promise<Campaign[]> {
    const where: Record<string | symbol, any> = { brandId };
    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.ne]: 'deleted' };
    }
    return this.campaignModel.findAll({
      where,
      include: this.fullIncludes,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Campaigns currently live.
   */
  findLiveCampaigns(page = 1, limit = 10): Promise<PaginatedResult<Campaign>> {
    return this.findAll({ status: 'live', page, limit });
  }

  /**
   * Campaigns that have ended (completed or cancelled).
   */
  findPastCampaigns(page = 1, limit = 10): Promise<PaginatedResult<Campaign>> {
    return this.findAll({ status: 'past', page, limit });
  }

  async updateStatus(id: string, status: string, approvedAt?: Date): Promise<Campaign | null> {
    const campaign = await this.campaignModel.findByPk(id);
    if (!campaign) return null;

    const updates: Partial<Attributes<Campaign>> = { status };
    if (approvedAt) {
      updates.approvedAt = approvedAt;
    }

    await campaign.update(updates);
    return this.findById(id);
  }

  // ─── Lookup tables ──────────────────────────────────────────────────────────

  findAllCategories(): Promise<CreatorCategory[]> {
    return this.creatorCategoryModel.findAll({
      order: [['minFollowers', 'ASC']],
    });
  }

  findAllPlatforms(): Promise<Platform[]> {
    return this.platformModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  createPayment(data: {
    campaignId: string;
    amount: number;
    totalAmount: number;
    paymentStatus: string;
    paymentReference?: string;
  }): Promise<Payment> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.paymentModel as any).create(data) as Promise<Payment>;
  }

  // ─── Fee Config CRUD ───────────────────────────────────────────────────────

  findFees(): Promise<Fee[]> {
    return this.feeModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  createFee(data: { name: string; type: string; value: number }): Promise<Fee> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.feeModel as any).create(data) as Promise<Fee>;
  }

  async deleteFee(id: string): Promise<boolean> {
    const affected = await this.feeModel.destroy({
      where: { id },
    });
    return affected > 0;
  }

  createApplication(data: {
    campaignId: string;
    creatorId: string;
    contentIdea: string;
    pastWorkLink?: string;
    primaryPlatformId: string;
    secondaryPlatformId?: string;
    feeRequest: number;
    comments?: string;
  }): Promise<CampaignApplication> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.campaignApplicationModel as any).create(data) as Promise<CampaignApplication>;
  }

  findApplicationById(id: string): Promise<CampaignApplication | null> {
    return this.campaignApplicationModel.findOne({
      where: { id },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
        },
        { model: Campaign, as: 'campaign' },
        { model: Platform, as: 'primaryPlatform' },
        { model: Platform, as: 'secondaryPlatform' },
        { model: ContentSubmission, as: 'submissions' },
      ],
    });
  }

  findApplication(campaignId: string, creatorId: string): Promise<CampaignApplication | null> {
    return this.campaignApplicationModel.findOne({
      where: { campaignId, creatorId },
    });
  }

  countApplications(campaignId: string): Promise<number> {
    return this.campaignApplicationModel.count({
      where: { campaignId },
    });
  }

  findApplicationsByCampaignId(campaignId: string): Promise<CampaignApplication[]> {
    return this.campaignApplicationModel.findAll({
      where: { campaignId },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'email',
            'username',
            'avatarUrl',
            'assignedTier',
            'instagramUsername',
            'instagramFollowers',
            'tiktokUsername',
            'tiktokFollowers',
            'youtubeUsername',
            'youtubeFollowers',
            'twitterUsername',
            'twitterFollowers',
          ],
        },
        { model: Platform, as: 'primaryPlatform' },
        { model: Platform, as: 'secondaryPlatform' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  findApplicationsByCreatorId(creatorId: string): Promise<CampaignApplication[]> {
    return this.campaignApplicationModel.findAll({
      where: { creatorId },
      include: [
        { model: Campaign, as: 'campaign' },
        { model: Platform, as: 'primaryPlatform' },
        { model: Platform, as: 'secondaryPlatform' },
        { model: ContentSubmission, as: 'submissions' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  findApplicationsByBrandId(brandId: string): Promise<CampaignApplication[]> {
    return this.campaignApplicationModel.findAll({
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: { brandId },
          required: true,
        },
        {
          model: User,
          as: 'creator',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'email',
            'username',
            'avatarUrl',
            'assignedTier',
            'instagramUsername',
            'instagramFollowers',
            'tiktokUsername',
            'tiktokFollowers',
            'youtubeUsername',
            'youtubeFollowers',
            'twitterUsername',
            'twitterFollowers',
          ],
        },
        { model: Platform, as: 'primaryPlatform' },
        { model: Platform, as: 'secondaryPlatform' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  findAllApplications(): Promise<CampaignApplication[]> {
    return this.campaignApplicationModel.findAll({
      include: [
        { model: Campaign, as: 'campaign' },
        {
          model: User,
          as: 'creator',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'email',
            'username',
            'avatarUrl',
            'assignedTier',
            'instagramUsername',
            'instagramFollowers',
            'tiktokUsername',
            'tiktokFollowers',
            'youtubeUsername',
            'youtubeFollowers',
            'twitterUsername',
            'twitterFollowers',
          ],
        },
        { model: Platform, as: 'primaryPlatform' },
        { model: Platform, as: 'secondaryPlatform' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  createSubmission(data: Partial<Attributes<ContentSubmission>>): Promise<ContentSubmission> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.contentSubmissionModel as any).create(data) as Promise<ContentSubmission>;
  }

  findSubmissionById(id: string): Promise<ContentSubmission | null> {
    return this.contentSubmissionModel.findOne({
      where: { id },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
        },
        { model: Campaign, as: 'campaign' },
        { model: CampaignApplication, as: 'application' },
      ],
    });
  }

  findLatestSubmissionByApplicationId(applicationId: string): Promise<ContentSubmission | null> {
    return this.contentSubmissionModel.findOne({
      where: { applicationId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
        },
        { model: Campaign, as: 'campaign' },
        { model: CampaignApplication, as: 'application' },
      ],
    });
  }

  findSubmissionsByCampaignId(campaignId: string): Promise<ContentSubmission[]> {
    return this.contentSubmissionModel.findAll({
      where: { campaignId },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
        },
        { model: Campaign, as: 'campaign' },
        { model: CampaignApplication, as: 'application' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  findSubmissionsByApplicationId(applicationId: string): Promise<ContentSubmission[]> {
    return this.contentSubmissionModel.findAll({
      where: { applicationId },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email', 'username'],
        },
        { model: Campaign, as: 'campaign' },
        { model: CampaignApplication, as: 'application' },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  createReview(
    data: Partial<Attributes<CampaignReview>>,
    transaction?: Transaction,
  ): Promise<CampaignReview> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.campaignReviewModel as any).create(data, {
      transaction,
    }) as Promise<CampaignReview>;
  }

  findReviewsByCreator(creatorId: string): Promise<CampaignReview[]> {
    return this.campaignReviewModel.findAll({
      where: { creatorId },
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  findReviewByBrandAndCampaign(
    brandId: string,
    campaignId: string,
  ): Promise<CampaignReview | null> {
    return this.campaignReviewModel.findOne({
      where: { brandId, campaignId },
    });
  }

  async recalculateCreatorRating(
    creatorId: string,
    transaction?: Transaction,
  ): Promise<{ avgRating: number; totalReviews: number }> {
    const result = (await this.campaignReviewModel.findOne({
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('star_rating')), 'avgRating'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalReviews'],
      ],
      where: { creatorId },
      raw: true,
      transaction,
    })) as unknown as Record<string, unknown> | null;

    const avgRaw = result?.avgRating;
    const avg =
      typeof avgRaw === 'string' || typeof avgRaw === 'number' ? parseFloat(String(avgRaw)) : 0;

    const totalRaw = result?.totalReviews;
    const total =
      typeof totalRaw === 'string' || typeof totalRaw === 'number'
        ? parseInt(String(totalRaw), 10)
        : 0;

    return {
      avgRating: parseFloat(avg.toFixed(2)),
      totalReviews: total,
    };
  }

  async findByIdAndBrandId(id: string, brandId: string): Promise<Campaign | null> {
    return this.campaignModel.findOne({
      where: { id, brandId },
    });
  }

  async deleteDraftById(id: string, brandId: string): Promise<void> {
    await this.campaignModel.update({ status: 'deleted' }, { where: { id, brandId } });
  }
}
