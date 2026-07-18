import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { AdminOverviewResponseDto } from '../dtos/admin-overview.dto';

@Injectable()
export class AdminOverviewService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(Dispute)
    private readonly disputeModel: typeof Dispute,
  ) {}

  async getOverview(): Promise<AdminOverviewResponseDto> {
    const creatorRole = await this.roleModel.findOne({ where: { name: 'creator' } });
    const brandRole = await this.roleModel.findOne({ where: { name: 'brand' } });

    const creatorRoleId = creatorRole ? creatorRole.id : null;
    const brandRoleId = brandRole ? brandRole.id : null;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalCreators,
      totalBrands,
      totalCampaigns,
      unresolvedDisputesCount,
      resolvedDisputesCount,
      creatorsAwaitingPaymentCount,
      campaignsByStatus,
      pendingVerificationCount,
      newThisWeekCount,
      allCreators,
      recentCampaignsRaw,
    ] = await Promise.all([
      // 1. Total Creators Count
      creatorRoleId
        ? this.userModel.count({ where: { roleId: creatorRoleId } })
        : Promise.resolve(0),

      // 2. Total Brands Count
      brandRoleId ? this.userModel.count({ where: { roleId: brandRoleId } }) : Promise.resolve(0),

      // 3. Total Campaigns Count
      this.campaignModel.count(),

      // 4. Unresolved Disputes Count ('raised' or 'under_review')
      this.disputeModel.count({
        where: { status: { [Op.in]: ['raised', 'under_review'] } },
      }),

      // 5. Resolved Disputes Count
      this.disputeModel.count({
        where: { status: 'resolved' },
      }),

      // 6. Creators Awaiting Payment Release (Accepted applications with work submitted / payout pending)
      this.applicationModel.count({
        where: { status: { [Op.in]: ['accepted', 'completed'] } },
      }),

      // 7. Campaigns grouped by status
      this.campaignModel.findAll({
        attributes: ['status'],
      }),

      // 8. Pending verification count (Creators with verification_status = 'pending')
      creatorRoleId
        ? this.userModel.count({
            where: {
              roleId: creatorRoleId,
              verificationStatus: 'pending',
            },
          })
        : Promise.resolve(0),

      // 9. New creators this week
      creatorRoleId
        ? this.userModel.count({
            where: {
              roleId: creatorRoleId,
              createdAt: { [Op.gte]: sevenDaysAgo },
            },
          })
        : Promise.resolve(0),

      // 10. All creators (for tier breakdown & top creators ranking)
      creatorRoleId
        ? this.userModel.findAll({
            where: { roleId: creatorRoleId },
            attributes: [
              'id',
              'firstName',
              'lastName',
              'username',
              'avatarUrl',
              'assignedTier',
              'instagramFollowers',
              'tiktokFollowers',
              'youtubeFollowers',
              'twitterFollowers',
            ],
            include: [{ model: CampaignApplication, as: 'applications' }],
          })
        : Promise.resolve([]),

      // 11. Recent 5 campaigns with brand and applications
      this.campaignModel.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          { model: User, as: 'brand', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
          { model: CampaignApplication, as: 'applications', attributes: ['id'] },
        ],
      }),
    ]);

    // ── Section 1 & 2: Top Metrics & Actions Required ─────────────────────
    const openDisputes = unresolvedDisputesCount;

    const topMetrics = {
      totalCreators,
      totalBrands,
      totalCampaigns,
      openDisputes,
    };

    const actionsRequired = {
      unresolvedDisputes: unresolvedDisputesCount,
      resolvedDisputes: resolvedDisputesCount,
      creatorsAwaitingPayment: creatorsAwaitingPaymentCount,
    };

    // ── Section 3: Campaign Overview Status Breakdown ───────────────────────
    let draft = 0;
    let live = 0;
    let active = 0;
    let postPending = 0;
    let completed = 0;

    for (const c of campaignsByStatus) {
      const status = (c.status || '').toLowerCase();
      if (status === 'draft') draft++;
      else if (status === 'live') live++;
      else if (status === 'active') active++;
      else if (status === 'pending_payment' || status === 'post_pending') postPending++;
      else if (status === 'completed') completed++;
    }

    const campaignOverview = {
      total: totalCampaigns,
      draft,
      live,
      active,
      postPending,
      completed,
    };

    // ── Section 4: Creator Tiers Calculation ────────────────────────────────
    let nanoCount = 0;
    let microCount = 0;
    let macroCount = 0;
    let megaCount = 0;

    for (const creator of allCreators) {
      const tierName = (creator.assignedTier || '').toLowerCase();
      if (tierName === 'mega') {
        megaCount++;
      } else if (tierName === 'macro') {
        macroCount++;
      } else if (tierName === 'micro') {
        microCount++;
      } else if (tierName === 'nano') {
        nanoCount++;
      } else {
        // Dynamic tier evaluation based on max followers across connected socials
        const maxFollowers = Math.max(
          creator.instagramFollowers || 0,
          creator.tiktokFollowers || 0,
          creator.youtubeFollowers || 0,
          creator.twitterFollowers || 0,
        );

        if (maxFollowers >= 1000000) megaCount++;
        else if (maxFollowers >= 100000) macroCount++;
        else if (maxFollowers >= 10000) microCount++;
        else nanoCount++;
      }
    }

    const totalReg = totalCreators || 1; // avoid division by zero
    const tiers = [
      {
        name: 'Nano',
        count: nanoCount,
        percentage: Number(((nanoCount / totalReg) * 100).toFixed(1)),
      },
      {
        name: 'Micro',
        count: microCount,
        percentage: Number(((microCount / totalReg) * 100).toFixed(1)),
      },
      {
        name: 'Macro',
        count: macroCount,
        percentage: Number(((macroCount / totalReg) * 100).toFixed(1)),
      },
      {
        name: 'Mega',
        count: megaCount,
        percentage: Number(((megaCount / totalReg) * 100).toFixed(1)),
      },
    ];

    const creatorTiers = {
      totalRegistered: totalCreators,
      pendingVerification: pendingVerificationCount,
      newThisWeek: newThisWeekCount,
      tiers,
    };

    // ── Section 5: Recent Campaign Activity ─────────────────────────────────
    const recentCampaignActivity = recentCampaignsRaw.map((c) => {
      const brandUser = c.brand;
      const brandName = brandUser
        ? `${brandUser.firstName || ''} ${brandUser.lastName || ''}`.trim() || 'Brand'
        : 'Unknown Brand';

      return {
        id: c.id,
        title: c.title,
        brandName,
        brandAvatar: brandUser?.avatarUrl || null,
        status: c.status,
        budget: c.totalBudget || 0,
        applicationsCount: c.applications ? c.applications.length : 0,
      };
    });

    // ── Section 6: Top Creators ─────────────────────────────────────────────
    const topCreatorsList = allCreators
      .map((cr) => {
        const completedApps = (cr.applications || []).filter(
          (a) => (a.status || '').toLowerCase() === 'completed',
        );
        const name = `${cr.firstName || ''} ${cr.lastName || ''}`.trim() || 'Creator';
        const handle = cr.username
          ? `@${cr.username.replace(/^@/, '')}`
          : `@${cr.firstName.toLowerCase()}`;
        const maxFollowers = Math.max(
          cr.instagramFollowers || 0,
          cr.tiktokFollowers || 0,
          cr.youtubeFollowers || 0,
          cr.twitterFollowers || 0,
        );

        let tier = cr.assignedTier || 'Nano';
        if (!cr.assignedTier) {
          if (maxFollowers >= 1000000) tier = 'Mega';
          else if (maxFollowers >= 100000) tier = 'Macro';
          else if (maxFollowers >= 10000) tier = 'Micro';
          else tier = 'Nano';
        }

        return {
          id: cr.id,
          name,
          handle,
          avatarUrl: cr.avatarUrl || null,
          tier,
          completedCampaigns: completedApps.length,
          totalEarnings: completedApps.reduce((acc, a) => acc + (a.feeRequest || 0), 0),
        };
      })
      .sort((a, b) => b.completedCampaigns - a.completedCampaigns)
      .slice(0, 5);

    return {
      topMetrics,
      actionsRequired,
      campaignOverview,
      creatorTiers,
      recentCampaignActivity,
      topCreators: topCreatorsList,
    };
  }
}
