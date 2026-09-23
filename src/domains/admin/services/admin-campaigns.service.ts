import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize } from 'sequelize';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from '../../campaigns/entities/creator-category.entity';
import { Platform } from '../../campaigns/entities/platform.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { ContentSubmission } from '../../campaigns/entities/content-submission.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { Payment } from '../../campaigns/entities/payment.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditLogService } from './audit-log.service';
import {
  CancelAdminCampaignDto,
  PauseAdminCampaignDto,
  ResumeAdminCampaignDto,
} from '../dtos/admin-cancel-campaign.dto';
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
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(ContentSubmission)
    private readonly contentSubmissionModel: typeof ContentSubmission,
    @InjectModel(PaymentRelease)
    private readonly paymentReleaseModel: typeof PaymentRelease,
    @InjectModel(CampaignRefund)
    private readonly campaignRefundModel: typeof CampaignRefund,
    @InjectModel(Payment)
    private readonly paymentModel: typeof Payment,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
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
    } else if (tab === 'paused') {
      where.status = 'paused';
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

  // ── 3. Campaign Cancellation ───────────────────────────────────────────────

  async cancelCampaign(
    adminId: string,
    campaignId: string,
    dto: CancelAdminCampaignDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; campaign: Campaign; summary: any }> {
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found.`);
    }

    if (campaign.status === 'cancelled') {
      throw new BadRequestException('Campaign is already cancelled.');
    }

    const cancellationDate = new Date();
    // Payouts scheduled for 30 days from cancellation date
    const releaseDate = new Date(cancellationDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    campaign.status = 'cancelled';
    await campaign.save();

    const payment = await this.paymentModel.findOne({
      where: { campaignId, paymentStatus: { [Op.in]: ['paid', 'escrowed', 'completed'] } },
    });
    const escrowId = payment?.escrowId || null;

    const acceptedApps = await this.applicationModel.findAll({
      where: {
        campaignId,
        status: { [Op.in]: ['accepted', 'approved'] },
      },
    });

    const submissions = await this.contentSubmissionModel.findAll({
      where: { campaignId },
    });

    let totalCreatorPayouts = 0;
    const creatorBreakdown: any[] = [];

    for (const app of acceptedApps) {
      const feeRequest = Number(app.feeRequest || 0);
      const hasSubmission = submissions.some(
        (s) => s.applicationId === app.id || s.creatorId === app.creatorId,
      );

      // Check 1: 100% payout if creator already submitted content (draft or live post)
      // Check 2: 50% payout if creator accepted but has not submitted content yet
      const percentage = hasSubmission ? 100 : 50;
      const payoutAmount = Math.round(feeRequest * (percentage / 100));

      if (payoutAmount > 0) {
        await this.paymentReleaseModel.create({
          campaignId,
          creatorId: app.creatorId,
          applicationId: app.id,
          amount: payoutAmount,
          releaseDate,
          status: 'pending',
          currency: campaign.currency || 'USD',
          escrowId,
        } as unknown as PaymentRelease);

        totalCreatorPayouts += payoutAmount;

        try {
          await this.notificationsService.notify({
            type: 'campaign.cancelled',
            recipientId: app.creatorId,
            actorId: adminId,
            data: {
              campaignId,
              campaignTitle: campaign.title,
              payoutAmount,
              payoutPercentage: percentage,
              releaseDate: releaseDate.toISOString(),
              reason: dto.reason || 'Campaign was cancelled by platform administration.',
            },
          });
        } catch {
          // ignore notification error
        }
      }

      creatorBreakdown.push({
        creatorId: app.creatorId,
        applicationId: app.id,
        feeRequest,
        payoutAmount,
        payoutPercentage: percentage,
        hasSubmission,
      });
    }

    const totalBudget = Number(campaign.totalBudget || 0);
    const remainingRefund = Math.max(0, totalBudget - totalCreatorPayouts);

    if (remainingRefund > 0 && payment) {
      await this.campaignRefundModel.create({
        campaignId,
        brandId: campaign.brandId,
        amount: remainingRefund,
        currency: campaign.currency || 'USD',
        status: 'pending',
        releaseDate,
      } as unknown as CampaignRefund);

      try {
        await this.notificationsService.notify({
          type: 'campaign.cancelled',
          recipientId: campaign.brandId,
          actorId: adminId,
          data: {
            campaignId,
            campaignTitle: campaign.title,
            refundAmount: remainingRefund,
            releaseDate: releaseDate.toISOString(),
            reason: dto.reason || 'Campaign was cancelled by platform administration.',
          },
        });
      } catch {
        // ignore notification error
      }
    }

    await this.auditLogService.log({
      adminId,
      action: 'CAMPAIGN_CANCELLED',
      targetUserId: campaign.brandId,
      ipAddress,
      userAgent,
      details: {
        campaignId,
        reason: dto.reason || null,
        totalCreatorPayouts,
        brandRefundAmount: remainingRefund,
        scheduledReleaseDate: releaseDate.toISOString(),
      },
    });

    return {
      message:
        'Campaign cancelled successfully. Creator payouts and brand refund scheduled for 30 days.',
      campaign,
      summary: {
        totalBudget,
        totalCreatorPayouts,
        brandRefundAmount: remainingRefund,
        scheduledReleaseDate: releaseDate.toISOString(),
        creatorsEvaluated: creatorBreakdown.length,
        creatorBreakdown,
      },
    };
  }

  // ── 4. Campaign Pause ──────────────────────────────────────────────────────

  async pauseCampaign(
    adminId: string,
    campaignId: string,
    dto: PauseAdminCampaignDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; campaign: Campaign }> {
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found.`);
    }

    if (campaign.status === 'paused') {
      throw new BadRequestException('Campaign is already paused.');
    }

    if (['cancelled', 'completed', 'draft'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot pause a campaign with status "${campaign.status}". Only active or live campaigns can be paused.`,
      );
    }

    campaign.status = 'paused';
    await campaign.save();

    // Notify brand
    try {
      await this.notificationsService.notify({
        type: 'campaign.paused',
        recipientId: campaign.brandId,
        actorId: adminId,
        data: {
          campaignId,
          campaignTitle: campaign.title,
          reason: dto.reason || 'Campaign was paused by platform administration.',
        },
      });
    } catch {
      // ignore notification error
    }

    // Notify accepted creators
    const acceptedApps = await this.applicationModel.findAll({
      where: {
        campaignId,
        status: { [Op.in]: ['accepted', 'approved'] },
      },
    });

    for (const app of acceptedApps) {
      try {
        await this.notificationsService.notify({
          type: 'campaign.paused',
          recipientId: app.creatorId,
          actorId: adminId,
          data: {
            campaignId,
            campaignTitle: campaign.title,
            reason: dto.reason || 'Campaign was paused by platform administration.',
          },
        });
      } catch {
        // ignore notification error
      }
    }

    await this.auditLogService.log({
      adminId,
      action: 'CAMPAIGN_PAUSED',
      targetUserId: campaign.brandId,
      ipAddress,
      userAgent,
      details: {
        campaignId,
        reason: dto.reason || null,
      },
    });

    return {
      message: 'Campaign paused successfully.',
      campaign,
    };
  }

  // ── 5. Campaign Resume ─────────────────────────────────────────────────────

  async resumeCampaign(
    adminId: string,
    campaignId: string,
    dto: ResumeAdminCampaignDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; campaign: Campaign }> {
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found.`);
    }

    if (campaign.status !== 'paused') {
      throw new BadRequestException(
        `Only paused campaigns can be resumed. Current status is "${campaign.status}".`,
      );
    }

    // Determine target status: if campaign has accepted applications, restore to 'active', otherwise 'live'
    const acceptedCount = await this.applicationModel.count({
      where: {
        campaignId,
        status: { [Op.in]: ['accepted', 'approved'] },
      },
    });

    campaign.status = acceptedCount > 0 ? 'active' : 'live';
    await campaign.save();

    // Notify brand
    try {
      await this.notificationsService.notify({
        type: 'campaign.resumed',
        recipientId: campaign.brandId,
        actorId: adminId,
        data: {
          campaignId,
          campaignTitle: campaign.title,
          reason: dto.reason || 'Campaign was resumed by platform administration.',
        },
      });
    } catch {
      // ignore notification error
    }

    // Notify accepted creators
    const acceptedApps = await this.applicationModel.findAll({
      where: {
        campaignId,
        status: { [Op.in]: ['accepted', 'approved'] },
      },
    });

    for (const app of acceptedApps) {
      try {
        await this.notificationsService.notify({
          type: 'campaign.resumed',
          recipientId: app.creatorId,
          actorId: adminId,
          data: {
            campaignId,
            campaignTitle: campaign.title,
            reason: dto.reason || 'Campaign was resumed by platform administration.',
          },
        });
      } catch {
        // ignore notification error
      }
    }

    await this.auditLogService.log({
      adminId,
      action: 'CAMPAIGN_RESUMED',
      targetUserId: campaign.brandId,
      ipAddress,
      userAgent,
      details: {
        campaignId,
        reason: dto.reason || null,
        restoredStatus: campaign.status,
      },
    });

    return {
      message: 'Campaign resumed successfully.',
      campaign,
    };
  }
}
