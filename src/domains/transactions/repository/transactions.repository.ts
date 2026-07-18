import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { Payment } from '../../campaigns/entities/payment.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { User } from '../../users/entities/user.entity';
import { getStatusDescription } from '../constants/transactions-status.constants';

export interface CreatorPayoutSummary {
  availableBalance: number;
  thirtyDayHold: number;
  totalEarned: number;
  totalFailed: number;
  currency: string;
}

export interface CreatorPayoutItem {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  amount: number;
  currency: string;
  /** released | failed | on_hold | pending */
  status: string;
  statusDescription: string;
  releaseDate: Date;
  createdAt: Date;
  errorDetails?: string | null;
}

export interface CreatorEscrowItem {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  amount: number;
  currency: string;
  /** pending | escrow_pending */
  releaseStatus: string;
  statusDescription: string;
  escrowStatus?: string | null;
  releaseDate: Date;
  daysRemaining: number;
  /** null = no dispute; raised | under_review | resolved */
  disputeStatus: string | null;
}

export interface BrandPaymentSummary {
  escrowBalance: number;
  thirtyDayHold: number;
  totalPayout: number;
  currency: string;
}

export interface BrandTransactionItem {
  id: string;
  /** escrow_funded | creator_payout | refund */
  type: string;
  /** Source DB table for debugging / traceability */
  table: 'payments' | 'payment_releases' | 'campaign_refunds';
  campaignId: string;
  campaignTitle: string;
  /** negative = money out, positive = money in (refunds) */
  amount: number;
  currency: string;
  date: Date;
  status: string;
  statusDescription: string;
}

export interface BrandEscrowItem {
  campaignId: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  /** funded | completed */
  escrowStatus: string;
  statusDescription: string;
  /** Source DB table for traceability */
  table: 'payments';
  releaseDate: Date | null;
  daysRemaining: number;
}

interface RawRelease {
  id: string;
  campaignId: string;
  amount: number;
  currency: string;
  status: string;
  releaseDate: Date;
  createdAt: Date;
  updatedAt: Date;
  errorDetails?: string | null;
}

interface RawPayment {
  id: string;
  campaignId: string;
  totalAmount?: number;
  amount: number;
  currency: string;
  escrowStatus?: string | null;
  createdAt: Date;
}

interface RawRefund {
  id: string;
  campaignId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
}

interface RawCampaign {
  id: string;
  title: string;
  currency: string;
  status: string;
  timeline?: Date | null;
}

interface RawDispute {
  campaignId: string;
  status: string;
}

@Injectable()
export class TransactionsRepository {
  constructor(
    @InjectModel(PaymentRelease)
    private readonly releaseModel: typeof PaymentRelease,
    @InjectModel(Payment)
    private readonly paymentModel: typeof Payment,
    @InjectModel(CampaignRefund)
    private readonly refundModel: typeof CampaignRefund,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(Dispute)
    private readonly disputeModel: typeof Dispute,
  ) {}

  // ─── CREATOR ────────────────────────────────────────────────────────────────

  /**
   * Aggregated summary totals for the creator's wallet card.
   */
  async getCreatorPayoutSummary(creatorId: string): Promise<CreatorPayoutSummary> {
    const now = new Date();

    const allReleases = (await this.releaseModel.findAll({
      where: { creatorId },
      attributes: ['amount', 'currency', 'status', 'releaseDate'],
      raw: true,
    })) as unknown as RawRelease[];

    let availableBalance = 0;
    let thirtyDayHold = 0;
    let totalEarned = 0;
    let totalFailed = 0;

    for (const r of allReleases) {
      const amt = Number(r.amount) || 0;
      if (r.status === 'released') {
        availableBalance += amt;
        totalEarned += amt;
      } else if (r.status === 'failed') {
        totalFailed += amt;
      } else if (r.status === 'pending' || r.status === 'escrow_pending') {
        if (new Date(r.releaseDate) > now) {
          thirtyDayHold += amt;
        }
      }
    }

    const currency = allReleases[0]?.currency ?? 'NGN';

    return { availableBalance, thirtyDayHold, totalEarned, totalFailed, currency };
  }

  /**
   * All payout transactions for the creator (Transactions tab).
   */
  async getCreatorPayouts(
    creatorId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: CreatorPayoutItem[]; count: number }> {
    const offset = (page - 1) * limit;

    const { rows, count } = await this.releaseModel.findAndCountAll({
      where: { creatorId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'title'],
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'firstName', 'lastName', 'username'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const items: CreatorPayoutItem[] = rows.map((r: PaymentRelease) => {
      const campaign = r.campaign;
      const brand = campaign?.brand;
      const brandName = brand ? `${brand.firstName} ${brand.lastName}`.trim() : 'Unknown Brand';

      return {
        id: r.id,
        campaignId: r.campaignId,
        campaignTitle: campaign?.title ?? 'Unknown Campaign',
        brandName,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        statusDescription: getStatusDescription('payment_releases', r.status),
        releaseDate: r.releaseDate,
        createdAt: r.createdAt,
        errorDetails: r.errorDetails ?? null,
      };
    });

    return { rows: items, count };
  }

  /**
   * Pending/escrow releases for the Escrow tab.
   */
  async getCreatorEscrowItems(creatorId: string): Promise<CreatorEscrowItem[]> {
    const now = new Date();

    const releases = await this.releaseModel.findAll({
      where: {
        creatorId,
        status: { [Op.in]: ['pending', 'escrow_pending'] },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'title', 'currency'],
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'firstName', 'lastName'],
            },
          ],
        },
      ],
      order: [['releaseDate', 'ASC']],
    });

    const campaignIds = [...new Set(releases.map((r: PaymentRelease) => r.campaignId))];
    const rawDisputes = campaignIds.length
      ? ((await this.disputeModel.findAll({
          where: { campaignId: { [Op.in]: campaignIds }, creatorId },
          attributes: ['campaignId', 'status'],
          raw: true,
        })) as unknown as RawDispute[])
      : [];
    const disputeMap = new Map<string, string>(rawDisputes.map((d) => [d.campaignId, d.status]));

    return releases.map((r: PaymentRelease) => {
      const releaseDate = new Date(r.releaseDate);
      const msRemaining = releaseDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      const campaign = r.campaign;
      const brand = campaign?.brand;
      const brandName = brand ? `${brand.firstName} ${brand.lastName}`.trim() : 'Unknown Brand';

      return {
        id: r.id,
        campaignId: r.campaignId,
        campaignTitle: campaign?.title ?? 'Unknown Campaign',
        brandName,
        amount: Number(r.amount),
        currency: r.currency,
        releaseStatus: r.status,
        statusDescription: getStatusDescription('payment_releases', r.status),
        escrowStatus: null,
        releaseDate,
        daysRemaining,
        disputeStatus: disputeMap.get(r.campaignId) ?? null,
      };
    });
  }

  // ─── BRAND ──────────────────────────────────────────────────────────────────

  /**
   * Summary card totals for the brand's Manage Payments screen.
   */
  async getBrandPaymentSummary(brandId: string): Promise<BrandPaymentSummary> {
    const campaigns = (await this.campaignModel.findAll({
      where: { brandId, status: { [Op.notIn]: ['deleted'] } },
      attributes: ['id', 'status', 'currency'],
      raw: true,
    })) as unknown as RawCampaign[];
    const campaignIds = campaigns.map((c) => c.id);

    if (campaignIds.length === 0) {
      return { escrowBalance: 0, thirtyDayHold: 0, totalPayout: 0, currency: 'NGN' };
    }

    const allPayments = (await this.paymentModel.findAll({
      where: {
        campaignId: { [Op.in]: campaignIds },
        paymentStatus: 'paid',
      },
      attributes: ['campaignId', 'totalAmount', 'amount', 'currency', 'escrowStatus'],
      raw: true,
    })) as unknown as RawPayment[];

    const releasedPayouts = (await this.releaseModel.findAll({
      where: {
        campaignId: { [Op.in]: campaignIds },
        status: 'released',
      },
      attributes: ['amount', 'currency'],
      raw: true,
    })) as unknown as RawRelease[];

    const activeStatuses = new Set(['live', 'active']);
    const activeCampaignIds = new Set(
      campaigns.filter((c) => activeStatuses.has(c.status)).map((c) => c.id),
    );

    let escrowBalance = 0;
    let thirtyDayHold = 0;
    for (const p of allPayments) {
      const amt = Number(p.totalAmount ?? p.amount) || 0;
      if (p.escrowStatus !== 'completed') {
        escrowBalance += amt;
      }
      if (activeCampaignIds.has(p.campaignId)) {
        thirtyDayHold += amt;
      }
    }

    const totalPayout = releasedPayouts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const currency = allPayments[0]?.currency ?? 'NGN';

    return { escrowBalance, thirtyDayHold, totalPayout, currency };
  }

  /**
   * Combined transaction ledger for brand (Transactions tab).
   */
  async getBrandTransactions(
    brandId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: BrandTransactionItem[]; count: number }> {
    const campaigns = (await this.campaignModel.findAll({
      where: { brandId, status: { [Op.notIn]: ['deleted'] } },
      attributes: ['id', 'title', 'currency'],
      raw: true,
    })) as unknown as RawCampaign[];
    const campaignIds = campaigns.map((c) => c.id);
    const campaignMap = new Map<string, { title: string; currency: string }>(
      campaigns.map((c) => [c.id, { title: c.title, currency: c.currency }]),
    );

    if (campaignIds.length === 0) {
      return { rows: [], count: 0 };
    }

    const payments = (await this.paymentModel.findAll({
      where: { campaignId: { [Op.in]: campaignIds }, paymentStatus: 'paid' },
      attributes: ['id', 'campaignId', 'totalAmount', 'amount', 'currency', 'createdAt'],
      raw: true,
    })) as unknown as RawPayment[];

    const releases = (await this.releaseModel.findAll({
      where: { campaignId: { [Op.in]: campaignIds } },
      attributes: ['id', 'campaignId', 'amount', 'currency', 'updatedAt', 'status'],
      raw: true,
    })) as unknown as RawRelease[];

    const refunds = (await this.refundModel.findAll({
      where: { brandId },
      attributes: ['id', 'campaignId', 'amount', 'currency', 'status', 'createdAt'],
      raw: true,
    })) as unknown as RawRefund[];

    const ledger: BrandTransactionItem[] = [
      ...payments.map((p) => ({
        id: p.id,
        type: 'escrow_funded' as const,
        table: 'payments' as const,
        campaignId: p.campaignId,
        campaignTitle: campaignMap.get(p.campaignId)?.title ?? 'Unknown Campaign',
        amount: -(Number(p.totalAmount ?? p.amount) || 0),
        currency: p.currency ?? campaignMap.get(p.campaignId)?.currency ?? 'NGN',
        date: new Date(p.createdAt),
        status: 'completed',
        statusDescription: getStatusDescription('payments', 'completed'),
      })),
      ...releases.map((r) => ({
        id: r.id,
        type: 'creator_payout' as const,
        table: 'payment_releases' as const,
        campaignId: r.campaignId,
        campaignTitle: campaignMap.get(r.campaignId)?.title ?? 'Unknown Campaign',
        amount: -(Number(r.amount) || 0),
        currency: r.currency ?? campaignMap.get(r.campaignId)?.currency ?? 'NGN',
        date: new Date(r.updatedAt),
        status: r.status,
        statusDescription: getStatusDescription('payment_releases', r.status),
      })),
      ...refunds.map((r) => ({
        id: r.id,
        type: 'refund' as const,
        table: 'campaign_refunds' as const,
        campaignId: r.campaignId,
        campaignTitle: campaignMap.get(r.campaignId)?.title ?? 'Unknown Campaign',
        amount: Number(r.amount) || 0,
        currency: r.currency ?? campaignMap.get(r.campaignId)?.currency ?? 'NGN',
        date: new Date(r.createdAt),
        status: r.status,
        statusDescription: getStatusDescription('campaign_refunds', r.status),
      })),
    ];

    ledger.sort((a, b) => b.date.getTime() - a.date.getTime());
    const count = ledger.length;
    const offset = (page - 1) * limit;
    const rows = ledger.slice(offset, offset + limit);

    return { rows, count };
  }

  /**
   * Active escrow positions for a brand (Escrow tab).
   */
  async getBrandEscrowItems(brandId: string): Promise<BrandEscrowItem[]> {
    const now = new Date();

    const campaigns = (await this.campaignModel.findAll({
      where: {
        brandId,
        status: { [Op.notIn]: ['deleted', 'cancelled'] },
      },
      attributes: ['id', 'title', 'currency', 'timeline'],
      raw: true,
    })) as unknown as RawCampaign[];
    const campaignIds = campaigns.map((c) => c.id);
    const campaignMap = new Map<string, RawCampaign>(campaigns.map((c) => [c.id, c]));

    if (campaignIds.length === 0) return [];

    const whereCondition: Record<string | symbol, unknown> = {
      campaignId: { [Op.in]: campaignIds },
      paymentStatus: 'paid',
      [Op.or]: [{ escrowStatus: { [Op.is]: null } }, { escrowStatus: { [Op.ne]: 'completed' } }],
    };

    const payments = (await this.paymentModel.findAll({
      where: whereCondition,
      attributes: ['campaignId', 'totalAmount', 'amount', 'currency', 'escrowStatus'],
      raw: true,
    })) as unknown as RawPayment[];

    return payments.map((p) => {
      const campaign = campaignMap.get(p.campaignId);
      const releaseDate = campaign?.timeline ? new Date(campaign.timeline) : null;
      const msRemaining = releaseDate ? releaseDate.getTime() - now.getTime() : 0;
      const daysRemaining = releaseDate
        ? Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
        : 0;

      const escrowStatus = p.escrowStatus ?? 'funded';
      return {
        campaignId: p.campaignId,
        campaignTitle: campaign?.title ?? 'Unknown Campaign',
        amount: Number(p.totalAmount ?? p.amount) || 0,
        currency: p.currency ?? campaign?.currency ?? 'NGN',
        escrowStatus,
        statusDescription: getStatusDescription('payments', escrowStatus),
        table: 'payments' as const,
        releaseDate,
        daysRemaining,
      };
    });
  }
}
