import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Payment } from '../../campaigns/entities/payment.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { Fee } from '../../campaigns/entities/fee.entity';
import { BrandCommissionTier } from '../entities/brand-commission-tier.entity';
import { CampaignsService } from '../../campaigns/services/campaigns.service';
import {
  QueryEscrowOverviewDto,
  QueryEscrowBalancesDto,
  QueryCreatorPayoutsDto,
  QueryAdvertiserRefundsDto,
} from '../dtos/admin-escrow.dto';
import { paginate } from '../../../shared/utils/pagination.utils';

export interface EscrowSummary {
  totalAdvertisersSpend: number;
  totalAgencyCommission: number;
  totalCreatorPayout: number;
  totalEscrowBalance: number;
}

@Injectable()
export class AdminEscrowService {
  private readonly logger = new Logger(AdminEscrowService.name);

  constructor(
    @InjectModel(Payment)
    private readonly paymentModel: typeof Payment,
    @InjectModel(PaymentRelease)
    private readonly paymentReleaseModel: typeof PaymentRelease,
    @InjectModel(CampaignRefund)
    private readonly campaignRefundModel: typeof CampaignRefund,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Fee)
    private readonly feeModel: typeof Fee,
    @InjectModel(BrandCommissionTier)
    private readonly commissionTierModel: typeof BrandCommissionTier,
    private readonly campaignsService: CampaignsService,
  ) {}

  /**
   * Global top-bar summary cards across all Escrow screens.
   * Commission rate is read from the fees table (or BrandCommissionTier default)
   * so it reflects any admin-configured value rather than a hardcoded 0.15.
   * For new payments the snapshotted commission_rate column is used for precision;
   * for legacy rows (null snapshot) the current live rate is used as a fallback.
   */
  async getGlobalSummary(): Promise<EscrowSummary> {
    const paidPayments = await this.paymentModel.findAll({
      where: {
        paymentStatus: { [Op.in]: ['paid', 'escrowed', 'completed'] },
      },
    });

    let totalAdvertisersSpend = 0;
    for (const p of paidPayments) {
      totalAdvertisersSpend += p.totalAmount || p.amount || 0;
    }

    // Fetch live commission rate from fees table for legacy rows fallback
    const commissionFeeRecord = await this.feeModel.findOne({ where: { name: 'Trendupp Fee' } });
    const defaultCommissionRate = commissionFeeRecord?.value ?? 0.15;

    // Sum commission using snapshotted rate per payment; fall back to live rate
    let totalAgencyCommission = 0;
    for (const p of paidPayments) {
      const amt = p.totalAmount || p.amount || 0;
      const rate = p.commissionRate ?? defaultCommissionRate;
      totalAgencyCommission += Math.round(amt * rate);
    }

    const releasedPayouts = await this.paymentReleaseModel.findAll({
      where: { status: 'released' },
    });
    let totalCreatorPayout = 0;
    for (const pr of releasedPayouts) {
      totalCreatorPayout += pr.amount || 0;
    }

    const activeEscrows = await this.paymentModel.findAll({
      where: {
        paymentStatus: { [Op.in]: ['paid', 'escrowed'] },
        escrowStatus: { [Op.ne]: 'released' },
      },
    });
    let totalEscrowBalance = 0;
    for (const p of activeEscrows) {
      totalEscrowBalance += p.totalAmount || p.amount || 0;
    }

    return {
      totalAdvertisersSpend,
      totalAgencyCommission,
      totalCreatorPayout,
      totalEscrowBalance,
    };
  }

  /**
   * Overview tab: Monthly charts & Recent Escrow Activity with commissions/tax/gateway breakdown
   */
  async getOverview(query: QueryEscrowOverviewDto) {
    const summary = await this.getGlobalSummary();
    const selectedYear = query.year || new Date().getFullYear();

    // Fetch live commission rate from fees table for chart calculations
    const commissionFeeRecord = await this.feeModel.findOne({ where: { name: 'Trendupp Fee' } });
    const liveCommissionRate = commissionFeeRecord?.value ?? 0.15;

    const monthNames = [
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

    const advertisersSpendChart = monthNames.map((month) => ({ month, amount: 0 }));
    const agencyCommissionChart = monthNames.map((month) => ({ month, amount: 0 }));
    const creatorPayoutChart = monthNames.map((month) => ({ month, amount: 0 }));
    const escrowBalanceChart = monthNames.map((month) => ({ month, amount: 0 }));

    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);

    const paymentsThisYear = await this.paymentModel.findAll({
      where: {
        createdAt: { [Op.between]: [yearStart, yearEnd] },
      },
    });

    for (const p of paymentsThisYear) {
      const m = new Date(p.createdAt).getMonth();
      const amt = p.totalAmount || p.amount || 0;
      // Use snapshotted commission rate if available; fall back to current live rate
      const commissionRate = p.commissionRate ?? liveCommissionRate;
      if (['paid', 'escrowed', 'completed'].includes(p.paymentStatus)) {
        advertisersSpendChart[m].amount += amt;
        agencyCommissionChart[m].amount += Math.round(amt * commissionRate);
      }
      if (['paid', 'escrowed'].includes(p.paymentStatus)) {
        escrowBalanceChart[m].amount += amt;
      }
    }

    const releasesThisYear = await this.paymentReleaseModel.findAll({
      where: {
        status: 'released',
        releaseDate: { [Op.between]: [yearStart, yearEnd] },
      },
    });

    for (const pr of releasesThisYear) {
      const m = new Date(pr.releaseDate).getMonth();
      creatorPayoutChart[m].amount += pr.amount || 0;
    }

    const recentPayments = await this.paymentModel.findAll({
      include: [
        {
          model: Campaign,
          as: 'campaign',
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
            },
          ],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 10,
    });

    const recentActivity = await Promise.all(
      recentPayments.map(async (p) => {
        const campaign = p.campaign;
        const brand = campaign?.brand;
        const brandObj = brand as (User & { companyName?: string }) | undefined;
        const brandName =
          brandObj?.companyName ||
          `${brand?.firstName || ''} ${brand?.lastName || ''}`.trim() ||
          'Advertiser';
        const totalFunded = p.totalAmount || p.amount || 0;

        const breakdown = await this.campaignsService.calculateBreakdown(
          totalFunded,
          p.currency || campaign?.currency || 'USD',
          campaign?.brandId,
        );

        let fundingStatus = 'pending';
        if (['paid', 'escrowed', 'completed'].includes(p.paymentStatus)) {
          fundingStatus = 'successful';
        } else if (p.paymentStatus === 'failed') {
          fundingStatus = 'failed';
        }

        return {
          id: p.id,
          campaignId: campaign?.id || null,
          campaignTitle: campaign?.title || 'Campaign',
          advertiser: {
            id: brand?.id || null,
            name: brandName,
          },
          totalFunded,
          breakdown: {
            agencyCommission: breakdown.trenduppFee,
            vat: breakdown.vat,
            gatewayCharges: breakdown.pandascrowFee,
            creatorNetBudget: breakdown.campaignBudget,
          },
          fundingStatus,
          campaignStatus: campaign?.status || 'active',
          lastUpdated: p.updatedAt,
        };
      }),
    );

    return {
      summary,
      charts: {
        platformRatePercentage: 15,
        advertisersSpend: advertisersSpendChart,
        agencyCommission: agencyCommissionChart,
        creatorPayout: creatorPayoutChart,
        escrowBalance: escrowBalanceChart,
      },
      recentActivity,
    };
  }

  /**
   * Escrow Tab: Current Money in Escrow & Paginated Escrow List
   */
  async getEscrowBalances(query: QueryEscrowBalancesDto) {
    const summary = await this.getGlobalSummary();
    const { page = 1, limit = 10, q, startDate, endDate } = query;

    const where: Record<string | symbol, unknown> = {};

    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const payments = await this.paymentModel.findAll({
      where: {
        paymentStatus: { [Op.in]: ['paid', 'escrowed'] },
      },
    });
    let currentMoneyInEscrow = 0;
    for (const p of payments) {
      currentMoneyInEscrow += p.totalAmount || p.amount || 0;
    }

    const campaignWhere: Record<string, unknown> = {};
    if (q) {
      const pattern = `%${q.trim()}%`;
      campaignWhere.title = { [Op.iLike]: pattern };
    }

    const paginated = await paginate(
      this.paymentModel,
      {
        where: where as WhereOptions<Payment>,
        include: [
          {
            model: Campaign,
            as: 'campaign',
            where: Object.keys(campaignWhere).length > 0 ? campaignWhere : undefined,
            include: [
              {
                model: User,
                as: 'brand',
                attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
              },
            ],
          },
        ],
        order: [['updatedAt', 'DESC']],
      },
      { page, limit },
    );

    const data = await Promise.all(
      paginated.data.map(async (p) => {
        const campaign = p.campaign;
        const brand = campaign?.brand;
        const brandObj = brand as (User & { companyName?: string }) | undefined;
        const brandName =
          brandObj?.companyName ||
          `${brand?.firstName || ''} ${brand?.lastName || ''}`.trim() ||
          'Advertiser';

        let fundingStatus = 'pending';
        if (['paid', 'escrowed', 'completed'].includes(p.paymentStatus)) {
          fundingStatus = 'successful';
        } else if (p.paymentStatus === 'failed') {
          fundingStatus = 'failed';
        }

        const totalFunded = p.totalAmount || p.amount || 0;

        // Build breakdown from snapshotted rates if available; fall back to live calculateBreakdown
        let breakdownData: {
          commission: number | null;
          commissionRate: number | null;
          vat: number | null;
          vatRate: number | null;
          gatewayFee: number;
          gatewayRate: number | null;
          netAmount: number | null;
        };

        if (p.commissionRate != null && p.vatRate != null && p.gatewayRate != null) {
          // New payment — use snapshotted rates for historical accuracy
          const commission = Math.round(totalFunded * p.commissionRate);
          const vat = Math.round(totalFunded * p.vatRate);
          const gatewayFee = p.gatewayFee ?? Math.round(totalFunded * p.gatewayRate);
          breakdownData = {
            commission,
            commissionRate: p.commissionRate,
            vat,
            vatRate: p.vatRate,
            gatewayFee,
            gatewayRate: p.gatewayRate,
            netAmount: totalFunded - commission - vat - gatewayFee,
          };
        } else {
          // Legacy payment (pre-snapshot) — fall back to live calculateBreakdown
          const bd = await this.campaignsService.calculateBreakdown(
            totalFunded,
            p.currency || campaign?.currency || 'NGN',
            campaign?.brandId,
          );
          breakdownData = {
            commission: bd.trenduppFee,
            commissionRate: bd.commissionRate,
            vat: bd.vat,
            vatRate: bd.vatRate,
            gatewayFee: p.gatewayFee ?? bd.pandascrowFee,
            gatewayRate: bd.gatewayRate,
            netAmount: bd.campaignBudget,
          };
        }

        return {
          id: p.id,
          campaignId: campaign?.id || null,
          campaignTitle: campaign?.title || 'Campaign',
          brand: {
            id: brand?.id || null,
            name: brandName,
          },
          totalFunded,
          breakdown: breakdownData,
          status: fundingStatus,
          campaignStatus: campaign?.status || 'active',
          paymentPortalUrl: p.paymentUrl || null,
          lastUpdated: p.updatedAt,
        };
      }),
    );

    return {
      summary,
      currentMoneyInEscrow,
      lastUpdated: new Date(),
      data,
      pagination: paginated.pagination,
    };
  }

  /**
   * Payout Tab — Creator Payouts
   */
  async getCreatorPayouts(query: QueryCreatorPayoutsDto) {
    const summary = await this.getGlobalSummary();
    const { page = 1, limit = 10, q, campaignId, creatorId, status, startDate, endDate } = query;

    const where: Record<string | symbol, unknown> = {};

    if (campaignId) where.campaignId = campaignId;
    if (creatorId) where.creatorId = creatorId;

    if (status && status !== 'all') {
      if (status === 'successful') where.status = 'released';
      else if (status === 'on_hold') where.status = { [Op.in]: ['escrow_pending', 'disputed'] };
      else where.status = status;
    }

    if (startDate && endDate) {
      where.releaseDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const campaignWhere: Record<string, unknown> = {};
    if (q) {
      const pattern = `%${q.trim()}%`;
      campaignWhere.title = { [Op.iLike]: pattern };
    }

    const allReleases = await this.paymentReleaseModel.findAll();
    const metrics = {
      pending: { count: 0, totalAmount: 0 },
      successful: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
      onHold: { count: 0, totalAmount: 0 },
    };

    for (const r of allReleases) {
      const amt = r.amount || 0;
      if (r.status === 'released') {
        metrics.successful.count++;
        metrics.successful.totalAmount += amt;
      } else if (r.status === 'pending') {
        metrics.pending.count++;
        metrics.pending.totalAmount += amt;
      } else if (r.status === 'failed') {
        metrics.failed.count++;
        metrics.failed.totalAmount += amt;
      } else if (r.status === 'escrow_pending' || r.status === 'disputed') {
        metrics.onHold.count++;
        metrics.onHold.totalAmount += amt;
      }
    }

    const paginated = await paginate(
      this.paymentReleaseModel,
      {
        where: where as WhereOptions<PaymentRelease>,
        include: [
          {
            model: Campaign,
            as: 'campaign',
            where: Object.keys(campaignWhere).length > 0 ? campaignWhere : undefined,
            include: [
              {
                model: User,
                as: 'brand',
                attributes: ['id', 'firstName', 'lastName'],
              },
            ],
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
          },
        ],
        order: [['updatedAt', 'DESC']],
      },
      { page, limit },
    );

    const data = paginated.data.map((pr) => {
      const campaign = pr.campaign;
      const brand = campaign?.brand;
      const creator = pr.creator;
      const brandObj = brand as (User & { companyName?: string }) | undefined;
      const brandName =
        brandObj?.companyName ||
        `${brand?.firstName || ''} ${brand?.lastName || ''}`.trim() ||
        'Advertiser';
      const creatorName =
        `${creator?.firstName || ''} ${creator?.lastName || ''}`.trim() || 'Creator';

      let uiStatus = 'pending';
      if (pr.status === 'released') uiStatus = 'successful';
      else if (pr.status === 'escrow_pending' || pr.status === 'disputed') uiStatus = 'on_hold';
      else if (pr.status === 'failed') uiStatus = 'failed';

      return {
        id: pr.id,
        campaignId: campaign?.id || null,
        campaignTitle: campaign?.title || 'Campaign',
        brandName,
        creator: {
          id: creator?.id || null,
          name: creatorName,
          avatarUrl: creator?.avatarUrl || null,
        },
        amount: pr.amount,
        status: uiStatus,
        failureReason: pr.errorDetails || null,
        lastUpdated: pr.updatedAt,
      };
    });

    return {
      summary,
      metrics,
      data,
      pagination: paginated.pagination,
    };
  }

  /**
   * Payout Tab — Advertiser Refunds
   */
  async getAdvertiserRefunds(query: QueryAdvertiserRefundsDto) {
    const summary = await this.getGlobalSummary();
    const { page = 1, limit = 10, q, campaignId, brandId, status, startDate, endDate } = query;

    const where: Record<string | symbol, unknown> = {};

    if (campaignId) where.campaignId = campaignId;
    if (brandId) where.brandId = brandId;

    if (status && status !== 'all') {
      if (status === 'successful') where.status = 'completed';
      else if (status === 'on_hold') where.status = 'pending_bank_details';
      else where.status = status;
    }

    if (startDate && endDate) {
      where.releaseDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const campaignWhere: Record<string, unknown> = {};
    if (q) {
      const pattern = `%${q.trim()}%`;
      campaignWhere.title = { [Op.iLike]: pattern };
    }

    const allRefunds = await this.campaignRefundModel.findAll();
    const metrics = {
      pending: { count: 0, totalAmount: 0 },
      successful: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
      onHold: { count: 0, totalAmount: 0 },
    };

    for (const rf of allRefunds) {
      const amt = rf.amount || 0;
      if (rf.status === 'completed') {
        metrics.successful.count++;
        metrics.successful.totalAmount += amt;
      } else if (rf.status === 'pending') {
        metrics.pending.count++;
        metrics.pending.totalAmount += amt;
      } else if (rf.status === 'failed') {
        metrics.failed.count++;
        metrics.failed.totalAmount += amt;
      } else if (rf.status === 'pending_bank_details') {
        metrics.onHold.count++;
        metrics.onHold.totalAmount += amt;
      }
    }

    const paginated = await paginate(
      this.campaignRefundModel,
      {
        where: where as WhereOptions<CampaignRefund>,
        include: [
          {
            model: Campaign,
            as: 'campaign',
            where: Object.keys(campaignWhere).length > 0 ? campaignWhere : undefined,
          },
          {
            model: User,
            as: 'brand',
            attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
          },
        ],
        order: [['updatedAt', 'DESC']],
      },
      { page, limit },
    );

    const data = paginated.data.map((rf) => {
      const campaign = rf.campaign;
      const brand = rf.brand;
      const brandObj = brand as (User & { companyName?: string }) | undefined;
      const brandName =
        brandObj?.companyName ||
        `${brand?.firstName || ''} ${brand?.lastName || ''}`.trim() ||
        'Advertiser';

      let uiStatus = 'pending';
      if (rf.status === 'completed') uiStatus = 'successful';
      else if (rf.status === 'pending_bank_details') uiStatus = 'on_hold';
      else if (rf.status === 'failed') uiStatus = 'failed';

      return {
        id: rf.id,
        campaignId: campaign?.id || null,
        campaignTitle: campaign?.title || 'Campaign',
        creator: {
          id: brand?.id || null,
          name: brandName,
          avatarUrl: brand?.avatarUrl || null,
        },
        amount: rf.amount,
        status: uiStatus,
        failureReason: rf.errorDetails || null,
        lastUpdated: rf.updatedAt,
      };
    });

    return {
      summary,
      metrics,
      data,
      pagination: paginated.pagination,
    };
  }
}
