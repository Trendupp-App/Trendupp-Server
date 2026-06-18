import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes, Op, Sequelize } from 'sequelize';
import { Campaign } from '../entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Platform } from '../entities/platform.entity';

@Injectable()
export class CampaignRepository {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(Platform)
    private readonly platformModel: typeof Platform,
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
  ];

  create(data: Partial<Attributes<Campaign>>): Promise<Campaign> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.campaignModel as any).create(data) as Promise<Campaign>;
  }

  findById(id: string): Promise<Campaign | null> {
    return this.campaignModel.findByPk(id, {
      include: this.fullIncludes,
    });
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignModel.findAll({
      include: this.fullIncludes,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Campaigns owned by a specific brand user.
   */
  findByBrandId(brandId: string): Promise<Campaign[]> {
    return this.campaignModel.findAll({
      where: { brandId },
      include: this.fullIncludes,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Campaigns currently live: status = 'live' AND within the duration window.
   * Uses Postgres interval arithmetic: approved_at + (duration || ' days')::interval
   */
  findLiveCampaigns(): Promise<Campaign[]> {
    return this.campaignModel.findAll({
      where: {
        status: 'live',
        [Op.and]: [
          Sequelize.literal(`"Campaign"."approved_at" IS NOT NULL`),
          Sequelize.literal(
            `NOW() <= "Campaign"."approved_at" + ("Campaign"."duration" || ' days')::interval`,
          ),
        ],
      },
      include: this.fullIncludes,
      order: [['approvedAt', 'DESC']],
    });
  }

  /**
   * Campaigns that have ended: completed, cancelled, or expired live campaigns.
   */
  findPastCampaigns(): Promise<Campaign[]> {
    return this.campaignModel.findAll({
      where: {
        [Op.or]: [
          { status: { [Op.in]: ['completed', 'cancelled'] } },
          Sequelize.literal(
            `("Campaign"."status" = 'live' AND "Campaign"."approved_at" IS NOT NULL AND NOW() > "Campaign"."approved_at" + ("Campaign"."duration" || ' days')::interval)`,
          ),
        ],
      },
      include: this.fullIncludes,
      order: [['createdAt', 'DESC']],
    });
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
}
