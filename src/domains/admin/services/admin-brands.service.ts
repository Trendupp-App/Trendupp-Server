import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Industry } from '../../users/entities/industry.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { Bank } from '../../users/entities/bank.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { Payment } from '../../campaigns/entities/payment.entity';
import {
  QueryBrandWidgetTimeFilterDto,
  QueryTopBrandsWidgetDto,
  QueryAdminBrandAnalyticsDto,
  QueryAdminBrandsListDto,
  AdminBrandSummaryResponseDto,
  TimeSeriesPointDto,
  TopBrandWidgetDto,
  IndustryBreakdownItemDto,
  BrandCountryBreakdownItemDto,
  AdminBrandAnalyticsResponseDto,
  AdminBrandsListResponseDto,
  AdminAdvertiserListItemDto,
  AdminBrandProfileResponseDto,
  AdminBrandCampaignHistoryResponseDto,
  BrandCampaignHistoryItemDto,
} from '../dtos/admin-brands.dto';

@Injectable()
export class AdminBrandsService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    @InjectModel(Industry)
    private readonly industryModel: typeof Industry,
    @InjectModel(Nationality)
    private readonly nationalityModel: typeof Nationality,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
  ) {}

  private async getBrandRoleId(): Promise<string | null> {
    const role = await this.roleModel.findOne({ where: { name: 'brand' } });
    return role ? role.id : null;
  }

  private buildDateWhere(
    query: {
      year?: number;
      month?: number;
      startDate?: string;
      endDate?: string;
    },
    dateField: string = 'createdAt',
  ): Record<string | symbol, unknown> {
    const where: Record<string | symbol, unknown> = {};

    let start: Date | null = null;
    let end: Date | null = null;

    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
    } else if (query.year) {
      const year = query.year;
      const month = query.month;
      if (month) {
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0, 23, 59, 59, 999);
      } else {
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59, 999);
      }
    }

    if (start && end) {
      const dateRange = { [Op.between]: [start, end] };
      if (dateField === 'lastLoginAt') {
        where[Op.or] = [
          { lastLoginAt: dateRange },
          { [Op.and]: [{ lastLoginAt: null }, { updatedAt: dateRange }] },
          { [Op.and]: [{ lastLoginAt: null }, { createdAt: dateRange }] },
        ];
      } else {
        where[dateField] = dateRange;
      }
    }

    return where;
  }

  // ── 1. Summary & Profile Completion ─────────────────────────────────────────

  async getBrandsSummary(): Promise<AdminBrandSummaryResponseDto> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) {
      return {
        summary: {
          totalAdvertisers: 0,
          profileCompleted: 0,
          suspendedAdvertisers: 0,
          pendingProfileCompletion: 0,
        },
        profileCompletionDistribution: [],
      };
    }

    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId },
      include: [
        { model: Industry, as: 'industries', attributes: ['id'] },
        { model: Role, as: 'role' },
      ],
    });

    const totalAdvertisers = advertisers.length;
    let profileCompleted = 0;
    let suspendedAdvertisers = 0;

    let comp100 = 0;
    let comp80 = 0;
    let comp60 = 0;
    let comp40 = 0;
    let comp20 = 0;

    for (const b of advertisers) {
      const pct = b.onboardingPercentage;
      if (pct === 100) profileCompleted++;
      if (!b.isActive || b.isFlagged) suspendedAdvertisers++;

      if (pct >= 90) comp100++;
      else if (pct >= 75) comp80++;
      else if (pct >= 55) comp60++;
      else if (pct >= 35) comp40++;
      else comp20++;
    }

    return {
      summary: {
        totalAdvertisers,
        profileCompleted,
        suspendedAdvertisers,
        pendingProfileCompletion: totalAdvertisers - profileCompleted,
      },
      profileCompletionDistribution: [
        { percentageLabel: '100%', count: comp100 },
        { percentageLabel: '80%', count: comp80 },
        { percentageLabel: '60%', count: comp60 },
        { percentageLabel: '40%', count: comp40 },
        { percentageLabel: '20%', count: comp20 },
      ],
    };
  }

  // ── 2. Signup Growth Widget ──────────────────────────────────────────────────

  async getSignupGrowth(query: QueryBrandWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId, ...dateWhere },
      attributes: ['createdAt'],
    });

    return this.generateTimeSeries(advertisers, query.period || 'monthly');
  }

  // ── 3. Active Users Widget ───────────────────────────────────────────────────

  async getActiveUsers(query: QueryBrandWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) return [];

    const dateWhere = this.buildDateWhere(query, 'lastLoginAt');
    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId, ...dateWhere },
      attributes: ['lastLoginAt', 'updatedAt', 'createdAt'],
    });

    return this.generateTimeSeries(advertisers, query.period || 'monthly', 'lastLoginAt');
  }

  // ── 4. Top Brands Widget ─────────────────────────────────────────────────────

  async getTopBrands(query: QueryTopBrandsWidgetDto): Promise<TopBrandWidgetDto[]> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) return [];

    const dateWhere = this.buildDateWhere(query);

    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId, ...dateWhere },
      attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl', 'websiteUrl'],
      include: [
        {
          model: Campaign,
          as: 'campaigns',
          attributes: ['id', 'status', 'totalBudget', 'paymentStatus'],
        },
      ],
    });

    const limit = query.limit || 5;

    return advertisers
      .map((b) => {
        const campaigns = b.campaigns || [];
        const brandName =
          `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || 'Brand';

        // Only sum totalBudget for campaigns with paymentStatus === 'paid'
        const totalSpend = campaigns
          .filter((c) => c.paymentStatus === 'paid')
          .reduce((acc, c) => acc + Number(c.totalBudget || 0), 0);

        return {
          id: b.id,
          brandName,
          websiteUrl: b.websiteUrl || null,
          logoUrl: b.avatarUrl || null,
          campaignsCount: campaigns.length,
          totalSpend,
        };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);
  }

  // ── 5. Industry Breakdown Widget ───────────────────────────────────────────

  async getIndustryBreakdown(
    query: QueryBrandWidgetTimeFilterDto,
  ): Promise<IndustryBreakdownItemDto[]> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId, ...dateWhere },
      include: [{ model: Industry, as: 'industries', attributes: ['name'] }],
    });

    const total = advertisers.length || 1;
    const industryCountMap = new Map<string, number>();

    for (const b of advertisers) {
      if (b.industries && b.industries.length > 0) {
        for (const ind of b.industries) {
          industryCountMap.set(ind.name, (industryCountMap.get(ind.name) || 0) + 1);
        }
      }
    }

    return Array.from(industryCountMap.entries())
      .map(([industry, count]) => ({
        industry,
        count,
        percentage: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // ── 6. Country Breakdown Widget ─────────────────────────────────────────────

  async getCountryBreakdown(
    query: QueryBrandWidgetTimeFilterDto,
  ): Promise<BrandCountryBreakdownItemDto[]> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const advertisers = await this.userModel.findAll({
      where: { roleId: brandRoleId, ...dateWhere },
      include: [{ model: Nationality, as: 'country', attributes: ['name'] }],
    });

    const total = advertisers.length || 1;
    const countryCountMap = new Map<string, number>();

    for (const b of advertisers) {
      const countryName = b.country?.name || 'Nigeria';
      countryCountMap.set(countryName, (countryCountMap.get(countryName) || 0) + 1);
    }

    return Array.from(countryCountMap.entries())
      .map(([country, count]) => ({
        country,
        count,
        percentage: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // ── 7. Combined Analytics Initial Load ─────────────────────────────────────

  async getBrandsAnalytics(
    query: QueryAdminBrandAnalyticsDto,
  ): Promise<AdminBrandAnalyticsResponseDto> {
    const summaryData = await this.getBrandsSummary();
    const signupGrowth = await this.getSignupGrowth(query);
    const activeLogins = await this.getActiveUsers(query);
    const topBrands = await this.getTopBrands(query);
    const industryBreakdown = await this.getIndustryBreakdown(query);
    const countryBreakdown = await this.getCountryBreakdown(query);

    return {
      summary: summaryData.summary,
      signupGrowth,
      activeLogins,
      topBrands,
      profileCompletionDistribution: summaryData.profileCompletionDistribution,
      industryBreakdown,
      countryBreakdown,
    };
  }

  // ── 8. Advertisers Table Listing ───────────────────────────────────────────

  async getBrandsList(query: QueryAdminBrandsListDto): Promise<AdminBrandsListResponseDto> {
    const brandRoleId = await this.getBrandRoleId();
    if (!brandRoleId) {
      return { data: [], meta: { total: 0, page: 1, limit: query.limit || 20, totalPages: 0 } };
    }

    const {
      q,
      tab = 'all',
      industryId,
      status,
      countryId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: Record<string | symbol, unknown> = { roleId: brandRoleId };

    if (q) {
      const pattern = `%${q.trim()}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: pattern } },
        { lastName: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { repFirstName: { [Op.iLike]: pattern } },
        { repLastName: { [Op.iLike]: pattern } },
        { repEmail: { [Op.iLike]: pattern } },
      ];
    }

    if (tab === 'suspended') {
      where.isActive = false;
    } else if (tab === 'pending') {
      where.verificationStatus = 'pending';
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'suspended') {
      where.isActive = false;
    } else if (status === 'pending') {
      where.verificationStatus = 'pending';
    }

    if (countryId) {
      where.countryId = countryId;
    }

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const includeIndustryWhere = industryId ? { id: industryId } : undefined;
    const offset = (page - 1) * limit;

    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
      include: [
        {
          model: Industry,
          as: 'industries',
          attributes: ['id', 'name'],
          where: includeIndustryWhere,
          required: !!industryId,
        },
        { model: Nationality, as: 'country', attributes: ['id', 'name'] },
        {
          model: Campaign,
          as: 'campaigns',
          attributes: ['id', 'status', 'totalBudget', 'paymentStatus'],
        },
      ],
    });

    const data: AdminAdvertiserListItemDto[] = rows.map((b, idx) => {
      const shortNum = (offset + idx + 1001).toString();
      const displayId = `#AD-${shortNum}`;

      const brandName =
        `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || 'Advertiser';
      const logoUrl = b.avatarUrl || null;

      const repName = `${b.repFirstName || ''} ${b.repLastName || ''}`.trim() || brandName;
      const repEmail = b.repEmail || b.email;

      const industryName = (b.industries || []).map((i) => i.name).join(', ') || 'Beverages';

      let brandStatus = 'ACTIVE';
      if (!b.isActive) {
        brandStatus = 'SUSPENDED';
      } else if (b.verificationStatus === 'pending') {
        brandStatus = 'PENDING';
      }

      const campaigns = b.campaigns || [];

      // Filter paid campaigns for totalSpend
      const totalSpend = campaigns
        .filter((c) => c.paymentStatus === 'paid')
        .reduce((acc, c) => acc + Number(c.totalBudget || 0), 0);

      return {
        id: b.id,
        displayId,
        advertiser: {
          brandName,
          logoUrl,
        },
        representative: {
          name: repName,
          email: repEmail,
        },
        industry: industryName,
        location: {
          city: b.city || null,
          country: b.country?.name || null,
        },
        profileCompletion: b.onboardingPercentage,
        status: brandStatus,
        totalSpend,
        campaignsCount: campaigns.length,
        joinDate: b.createdAt,
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

  // ── 9. Brand Profile View Details ────────────────────────────────────────────

  async getBrandProfileDetails(id: string): Promise<AdminBrandProfileResponseDto> {
    const advertiser = await this.userModel.findOne({
      where: { id },
      include: [
        { model: Industry, as: 'industries', attributes: ['name'] },
        { model: Nationality, as: 'country', attributes: ['name'] },
        { model: Bank, as: 'bank', attributes: ['id', 'name', 'code'] },
        {
          model: Campaign,
          as: 'campaigns',
          attributes: ['id', 'status', 'totalBudget', 'paymentStatus'],
        },
      ],
    });

    if (!advertiser) {
      throw new NotFoundException(`Brand advertiser with ID "${id}" not found.`);
    }

    const brandName =
      `${advertiser.firstName || ''} ${advertiser.lastName || ''}`.trim() ||
      advertiser.username ||
      'Brand';

    const industryName = (advertiser.industries || []).map((i) => i.name).join(', ') || 'FMCG';

    const accountStatus = !advertiser.isActive
      ? 'Suspended'
      : advertiser.verificationStatus === 'pending'
        ? 'Pending'
        : 'Active';

    const repFullName =
      `${advertiser.repFirstName || ''} ${advertiser.repLastName || ''}`.trim() || brandName;
    const repEmail = advertiser.repEmail || advertiser.email;
    const repPhone = advertiser.repPhone || null;

    const stateCity = advertiser.city
      ? `${advertiser.country?.name || 'Nigeria'}/${advertiser.city}`
      : advertiser.country?.name || 'Nigeria';

    const campaigns = advertiser.campaigns || [];
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(
      (c) => c.status === 'active' || c.status === 'live',
    ).length;

    // Filter paid campaigns for totalSpend
    const totalSpend = campaigns
      .filter((c) => c.paymentStatus === 'paid')
      .reduce((acc, c) => acc + Number(c.totalBudget || 0), 0);

    const formattedDateJoined = advertiser.createdAt
      ? new Date(advertiser.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'N/A';

    return {
      header: {
        brandName,
        websiteUrl: advertiser.websiteUrl || null,
        logoUrl: advertiser.avatarUrl || null,
        industry: industryName,
        status: accountStatus,
      },
      brandDetails: {
        brandName,
        email: advertiser.email,
        website: advertiser.websiteUrl || null,
        bio: advertiser.bio || null,
        country: advertiser.country?.name || 'Nigeria',
        stateCity,
        monthlyBudget: advertiser.monthlyBudget || null,
      },
      brandRepresentative: {
        fullName: repFullName,
        email: repEmail,
        phoneNumber: repPhone,
        profileCompletion: advertiser.onboardingPercentage,
        dateJoined: formattedDateJoined,
        accountStatus,
      },
      metrics: {
        totalCampaigns,
        totalSpend,
        activeCampaigns,
        avgCreatorRating: 4.7,
      },
      bankDetails: {
        accountName: advertiser.bankAccountName || null,
        accountNumber: advertiser.bankAccountNumber || null,
        bankId: advertiser.bankId || null,
        bankName: advertiser.bank?.name || null,
        bankCode: advertiser.bank?.code || null,
      },
    };
  }

  // ── 10. Brand Campaign History ───────────────────────────────────────────────

  async getBrandCampaignHistory(
    id: string,
    page = 1,
    limit = 10,
  ): Promise<AdminBrandCampaignHistoryResponseDto> {
    const offset = (page - 1) * limit;

    const { rows, count } = await this.campaignModel.findAndCountAll({
      where: { brandId: id },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id'],
        },
        {
          model: Payment,
          as: 'payments',
        },
      ],
    });

    const data: BrandCampaignHistoryItemDto[] = rows.map((c) => {
      const timeline = (c.timeline as Record<string, unknown>) || {};
      const stage1 = timeline.stage1_application_window as Record<string, unknown> | undefined;

      const startDateRaw =
        (timeline.startDate as string | Date | undefined) ||
        (stage1?.startDate as string | Date | undefined) ||
        c.approvedAt ||
        c.createdAt ||
        null;

      const endDateRaw =
        (timeline.endDate as string | Date | undefined) ||
        (stage1?.endedDate as string | Date | undefined) ||
        null;

      const startDate: Date | string | null = startDateRaw;
      const endDate: Date | string | null = endDateRaw;

      const payments = c.payments || [];
      const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;

      return {
        id: c.id,
        title: c.title,
        type: c.type || 'paid',
        totalBudget: Number(c.totalBudget || 0),
        amount: latestPayment ? Number(latestPayment.amount || 0) : Number(c.totalBudget || 0),
        currency: latestPayment?.currency || c.currency || 'USD',
        gatewayFee: latestPayment ? Number(latestPayment.gatewayFee || 0) : 0,
        commissionFee:
          latestPayment?.commissionFee ?? Math.round(Number(c.totalBudget || 0) * 0.15),
        vatFee: latestPayment?.vatFee ?? Math.round(Number(c.totalBudget || 0) * 0.075),
        commissionRate: latestPayment?.commissionRate ?? 0.15,
        vatRate: latestPayment?.vatRate ?? 0.075,
        gatewayRate: latestPayment?.gatewayRate ?? 0.03,
        status: (c.status || 'DRAFT').toUpperCase(),
        paymentStatus: (c.paymentStatus || 'UNPAID').toUpperCase(),
        applicationsCount: c.applications ? c.applications.length : 0,
        startDate,
        endDate,
        createdAt: c.createdAt,
      };
    });

    return {
      data,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  // ── Helper methods for chart series generation ────────────────────────────

  private generateTimeSeries(
    advertisers: User[],
    period: 'daily' | 'weekly' | 'monthly',
    dateField: keyof User = 'createdAt',
  ) {
    const months = [
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

    const getTargetDate = (u: User): Date | null => {
      // `dateField` is `keyof User`, so `u[dateField]` can type as one of the
      // model's methods, which trips @typescript-eslint/unbound-method. Index
      // through a plain record instead — the value is only ever a date column.
      const val = (
        typeof u.getDataValue === 'function'
          ? u.getDataValue(dateField)
          : (u as unknown as Record<string, unknown>)[dateField]
      ) as Date | string | number | null | undefined;
      if (val instanceof Date) return val;
      if (typeof val === 'string' || typeof val === 'number') return new Date(val);
      if (u.updatedAt) return new Date(u.updatedAt);
      if (u.createdAt) return new Date(u.createdAt);
      return null;
    };

    if (period === 'monthly') {
      const monthCounts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const b of advertisers) {
        const dt = getTargetDate(b);
        if (dt) {
          const m = dt.getMonth();
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      }
      return months.map((label, i) => ({ label, count: monthCounts[i] || 0 }));
    }

    if (period === 'weekly') {
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const weekCounts: number[] = [0, 0, 0, 0];
      for (const b of advertisers) {
        const dt = getTargetDate(b);
        if (dt) {
          const day = dt.getDate();
          const w = Math.min(Math.floor((day - 1) / 7), 3);
          weekCounts[w] = (weekCounts[w] || 0) + 1;
        }
      }
      return weeks.map((label, i) => ({ label, count: weekCounts[i] || 0 }));
    }

    const daysInMonth = 30;
    const dailyCounts: number[] = new Array(daysInMonth).fill(0) as number[];
    for (const b of advertisers) {
      const dt = getTargetDate(b);
      if (dt) {
        const d = Math.min(dt.getDate() - 1, daysInMonth - 1);
        if (d >= 0) dailyCounts[d] = (dailyCounts[d] || 0) + 1;
      }
    }
    return dailyCounts.map((cnt: number, i: number) => ({
      label: `Day ${i + 1}`,
      count: cnt || 0,
    }));
  }
}
