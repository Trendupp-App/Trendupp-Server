import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from '../../campaigns/entities/creator-category.entity';
import { Platform } from '../../campaigns/entities/platform.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import {
  QueryAdminCampaignsListDto,
  AdminCampaignSummaryResponseDto,
  AdminCampaignsListResponseDto,
  AdminCampaignListItemDto,
} from '../dtos/admin-campaigns.dto';

@Injectable()
export class AdminCampaignsService {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(CreatorCategory)
    private readonly creatorCategoryModel: typeof CreatorCategory,
    @InjectModel(Platform)
    private readonly platformModel: typeof Platform,
  ) {}

  // ── 1. Summary KPI Cards Overview ──────────────────────────────────────────

  async getCampaignsSummary(): Promise<AdminCampaignSummaryResponseDto> {
    const campaigns = await this.campaignModel.findAll({
      attributes: ['id', 'status', 'paymentStatus'],
    });

    const totalCampaigns = campaigns.length;
    let draft = 0;
    let live = 0;
    let active = 0;
    let completed = 0;
    let cancelled = 0;

    for (const c of campaigns) {
      const st = (c.status || '').toLowerCase();
      const ps = (c.paymentStatus || '').toLowerCase();

      if (st === 'draft' || ps === 'unpaid') {
        draft++;
      } else if (st === 'live') {
        live++;
      } else if (st === 'active') {
        active++;
      } else if (st === 'completed') {
        completed++;
      } else if (st === 'cancelled') {
        cancelled++;
      } else {
        // Default active if paid
        active++;
      }
    }

    return {
      totalCampaigns,
      draft,
      live,
      active,
      completed,
      cancelled,
    };
  }

  // ── 2. Filterable Campaigns Table Listing ──────────────────────────────────

  async getCampaignsList(
    query: QueryAdminCampaignsListDto,
  ): Promise<AdminCampaignsListResponseDto> {
    const {
      q,
      tab = 'all',
      escrowStatus,
      creatorTier,
      platform,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: Record<string | symbol, unknown> = {};

    // Tab Filter
    if (tab === 'draft') {
      where[Op.or] = [{ status: 'draft' }, { paymentStatus: 'unpaid' }];
    } else if (tab === 'live') {
      where.status = 'live';
    } else if (tab === 'active') {
      where.status = 'active';
    } else if (tab === 'completed') {
      where.status = 'completed';
    } else if (tab === 'cancelled') {
      where.status = 'cancelled';
    }

    // Escrow Status Filter
    if (escrowStatus) {
      const es = escrowStatus.toLowerCase();
      if (es === 'funded') {
        where.paymentStatus = { [Op.in]: ['paid', 'escrowed'] };
      } else if (es === 'released') {
        where.paymentStatus = 'released';
      } else if (es === 'not_funded' || es === 'not funded') {
        where.paymentStatus = 'unpaid';
      } else if (es === 'refunded') {
        where.paymentStatus = 'refunded';
      }
    }

    // Search Query Filter
    if (q) {
      const pattern = `%${q.trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: pattern } },
        Sequelize.where(Sequelize.cast(Sequelize.col('Campaign.id'), 'varchar'), {
          [Op.iLike]: pattern,
        }),
        { '$brand.first_name$': { [Op.iLike]: pattern } },
        { '$brand.last_name$': { [Op.iLike]: pattern } },
        { '$brand.email$': { [Op.iLike]: pattern } },
      ];
    }

    // Date Range Filter
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const categoryWhere = creatorTier
      ? { name: { [Op.iLike]: `%${creatorTier.trim()}%` } }
      : undefined;

    const platformWhere = platform ? { name: { [Op.iLike]: `%${platform.trim()}%` } } : undefined;

    const offset = (page - 1) * limit;

    const { rows, count } = await this.campaignModel.findAndCountAll({
      where,
      limit,
      offset,
      subQuery: false,
      order: [['createdAt', 'DESC']],
      distinct: true,
      include: [
        {
          model: User,
          as: 'brand',
          attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'avatarUrl'],
        },
        {
          model: CreatorCategory,
          as: 'creatorCategory',
          attributes: ['id', 'name'],
          where: categoryWhere,
          required: !!creatorTier,
        },
        {
          model: Platform,
          as: 'preferredPlatforms',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          where: platformWhere,
          required: !!platform,
        },
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id'],
        },
      ],
    });

    const data: AdminCampaignListItemDto[] = rows.map((c, idx) => {
      const shortNum = (offset + idx + 1001).toString();
      const displayId = `TRD-${shortNum}`;

      const brandObj = c.brand;
      const brandName = brandObj
        ? `${brandObj.firstName || ''} ${brandObj.lastName || ''}`.trim() ||
          brandObj.username ||
          'Brand'
        : 'Brand';
      const brandLogo = brandObj?.avatarUrl || null;

      const tier = c.creatorCategory?.name || 'Micro';
      const platforms = (c.preferredPlatforms || []).map((p) => p.name).join(', ') || 'Instagram';

      // Status mapping
      let itemStatus = (c.status || 'ACTIVE').toUpperCase();
      if (c.paymentStatus === 'unpaid' && itemStatus !== 'DRAFT') {
        itemStatus = 'DRAFT';
      }

      // Escrow mapping
      let escrowBadge = 'NOT FUNDED';
      const ps = (c.paymentStatus || '').toLowerCase();
      if (ps === 'paid' || ps === 'escrowed') {
        escrowBadge = 'FUNDED';
      } else if (ps === 'released') {
        escrowBadge = 'RELEASED';
      } else if (ps === 'refunded') {
        escrowBadge = 'REFUNDED';
      }

      const timelineObj = c.timeline as Record<string, { endedDate?: string }> | null | undefined;
      const endedDateStr = timelineObj?.stage1_application_window?.endedDate;

      return {
        id: c.id,
        displayId,
        title: c.title,
        brand: {
          id: c.brandId,
          name: brandName,
          logoUrl: brandLogo,
        },
        budget: Number(c.totalBudget || 0),
        creatorTier: tier,
        postingPlatform: platforms,
        applicationsCount: c.applications ? c.applications.length : 0,
        status: itemStatus,
        escrowStatus: escrowBadge,
        endDate: endedDateStr ? new Date(endedDateStr) : null,
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
}
