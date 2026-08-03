import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Niche } from '../../users/entities/niche.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { Bank } from '../../users/entities/bank.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import {
  QueryWidgetTimeFilterDto,
  QueryTopCreatorsWidgetDto,
  QueryAdminCreatorAnalyticsDto,
  QueryAdminCreatorsListDto,
  AdminCreatorSummaryResponseDto,
  TimeSeriesPointDto,
  TopCreatorWidgetDto,
  TierDistributionItemDto,
  GenderDistributionItemDto,
  NicheBreakdownItemDto,
  CountryBreakdownItemDto,
  AdminCreatorAnalyticsResponseDto,
  AdminCreatorsListResponseDto,
  AdminCreatorListItemDto,
  AdminCreatorProfileResponseDto,
  AdminCreatorCampaignHistoryResponseDto,
  AdminCreatorReviewsResponseDto,
  CreatorSocialAccountDto,
} from '../dtos/admin-creators.dto';

@Injectable()
export class AdminCreatorsService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(Nationality)
    private readonly nationalityModel: typeof Nationality,
    @InjectModel(CampaignApplication)
    private readonly applicationModel: typeof CampaignApplication,
    @InjectModel(PaymentRelease)
    private readonly releaseModel: typeof PaymentRelease,
  ) {}

  private async getCreatorRoleId(): Promise<string | null> {
    const role = await this.roleModel.findOne({ where: { name: 'creator' } });
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

  async getCreatorsSummary(): Promise<AdminCreatorSummaryResponseDto> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) {
      return {
        summary: {
          totalCreators: 0,
          profileCompleted: 0,
          suspendedCreators: 0,
          pendingProfileCompletion: 0,
        },
        connectedSocials: { instagram: 0, tiktok: 0, youtube: 0, twitter: 0, facebook: 0 },
        profileCompletionDistribution: [],
      };
    }

    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId },
      include: [
        { model: Niche, as: 'niches', attributes: ['id'] },
        { model: Role, as: 'role' },
      ],
    });

    const totalCreators = creators.length;
    let profileCompleted = 0;
    let suspendedCreators = 0;

    let comp100 = 0;
    let comp80 = 0;
    let comp40 = 0;
    let comp20 = 0;

    const connectedSocials = { instagram: 0, tiktok: 0, youtube: 0, twitter: 0, facebook: 0 };

    for (const c of creators) {
      const pct = c.onboardingPercentage;
      if (pct === 100) profileCompleted++;
      if (!c.isActive || c.isFlagged) suspendedCreators++;

      if (pct >= 90) comp100++;
      else if (pct >= 75) comp80++;
      else if (pct >= 35) comp40++;
      else comp20++;

      if (c.instagramUsername) connectedSocials.instagram++;
      if (c.tiktokUsername) connectedSocials.tiktok++;
      if (c.youtubeUsername) connectedSocials.youtube++;
      if (c.twitterUsername) connectedSocials.twitter++;
      if (c.facebookUsername) connectedSocials.facebook++;
    }

    return {
      summary: {
        totalCreators,
        profileCompleted,
        suspendedCreators,
        pendingProfileCompletion: totalCreators - profileCompleted,
      },
      connectedSocials,
      profileCompletionDistribution: [
        { percentageLabel: '100%', count: comp100 },
        { percentageLabel: '80%', count: comp80 },
        { percentageLabel: '40%', count: comp40 },
        { percentageLabel: '20%', count: comp20 },
      ],
    };
  }

  // ── 2. Signup Growth Widget ──────────────────────────────────────────────────

  async getSignupGrowth(query: QueryWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      attributes: ['createdAt'],
    });

    return this.generateTimeSeries(creators, query.period || 'monthly');
  }

  // ── 3. Active Users Widget ───────────────────────────────────────────────────

  async getActiveUsers(query: QueryWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query, 'lastLoginAt');
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      attributes: ['lastLoginAt', 'updatedAt', 'createdAt'],
    });

    return this.generateTimeSeries(creators, query.period || 'monthly', 'lastLoginAt');
  }

  // ── 4. Top Creators Widget ───────────────────────────────────────────────────

  async getTopCreators(query: QueryTopCreatorsWidgetDto): Promise<TopCreatorWidgetDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);

    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
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
      include: [
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id', 'status', 'feeRequest'],
        },
      ],
    });

    const limit = query.limit || 5;

    return creators
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
          campaignsCount: completedApps.length,
          totalEarnings: completedApps.reduce((acc, a) => acc + (a.feeRequest || 0), 0),
        };
      })
      .sort((a, b) => b.campaignsCount - a.campaignsCount)
      .slice(0, limit);
  }

  // ── 5. Creator Tier Distribution Widget ─────────────────────────────────────

  async getTierDistribution(query: QueryWidgetTimeFilterDto): Promise<TierDistributionItemDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      attributes: [
        'assignedTier',
        'instagramFollowers',
        'tiktokFollowers',
        'youtubeFollowers',
        'twitterFollowers',
      ],
    });

    const total = creators.length || 1;
    let nano = 0;
    let micro = 0;
    let macro = 0;
    let mega = 0;

    for (const c of creators) {
      const tierName = (c.assignedTier || '').toLowerCase();
      if (tierName === 'mega') mega++;
      else if (tierName === 'macro') macro++;
      else if (tierName === 'micro') micro++;
      else if (tierName === 'nano') nano++;
      else {
        const maxFollowers = Math.max(
          c.instagramFollowers || 0,
          c.tiktokFollowers || 0,
          c.youtubeFollowers || 0,
          c.twitterFollowers || 0,
        );
        if (maxFollowers >= 1000000) mega++;
        else if (maxFollowers >= 100000) macro++;
        else if (maxFollowers >= 10000) micro++;
        else nano++;
      }
    }

    return [
      { tier: 'Nano', count: nano, percentage: Number(((nano / total) * 100).toFixed(1)) },
      { tier: 'Micro', count: micro, percentage: Number(((micro / total) * 100).toFixed(1)) },
      { tier: 'Macro', count: macro, percentage: Number(((macro / total) * 100).toFixed(1)) },
      { tier: 'Mega', count: mega, percentage: Number(((mega / total) * 100).toFixed(1)) },
    ];
  }

  // ── 6. Gender Distribution Widget ───────────────────────────────────────────

  async getGenderDistribution(
    query: QueryWidgetTimeFilterDto,
  ): Promise<GenderDistributionItemDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      attributes: ['gender'],
    });

    const total = creators.length || 1;
    const genderCountMap = new Map<string, number>();

    for (const c of creators) {
      if (c.gender) {
        const g = c.gender.trim();
        const normalized = g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
        genderCountMap.set(normalized, (genderCountMap.get(normalized) || 0) + 1);
      }
    }

    return Array.from(genderCountMap.entries()).map(([gender, count]) => ({
      gender,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }));
  }

  // ── 7. Niche Breakdown Widget ───────────────────────────────────────────────

  async getNicheBreakdown(query: QueryWidgetTimeFilterDto): Promise<NicheBreakdownItemDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      include: [{ model: Niche, as: 'niches', attributes: ['name'] }],
    });

    const total = creators.length || 1;
    const nicheCountMap = new Map<string, number>();

    for (const c of creators) {
      if (c.niches && c.niches.length > 0) {
        for (const n of c.niches) {
          nicheCountMap.set(n.name, (nicheCountMap.get(n.name) || 0) + 1);
        }
      }
    }

    return Array.from(nicheCountMap.entries())
      .map(([niche, count]) => ({
        niche,
        count,
        percentage: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // ── 8. Country Breakdown Widget ─────────────────────────────────────────────

  async getCountryBreakdown(query: QueryWidgetTimeFilterDto): Promise<CountryBreakdownItemDto[]> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) return [];

    const dateWhere = this.buildDateWhere(query);
    const creators = await this.userModel.findAll({
      where: { roleId: creatorRoleId, ...dateWhere },
      include: [{ model: Nationality, as: 'country', attributes: ['name'] }],
    });

    const total = creators.length || 1;
    const countryCountMap = new Map<string, number>();

    for (const c of creators) {
      const countryName = c.country?.name || 'Nigeria';
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

  // ── 9. Combined Analytics Initial Load ─────────────────────────────────────

  async getCreatorsAnalytics(
    query: QueryAdminCreatorAnalyticsDto,
  ): Promise<AdminCreatorAnalyticsResponseDto> {
    const [
      summaryData,
      signupGrowth,
      activeLogins,
      tierDistribution,
      genderDistribution,
      nicheBreakdown,
      countryBreakdown,
    ] = await Promise.all([
      this.getCreatorsSummary(),
      this.getSignupGrowth(query),
      this.getActiveUsers(query),
      this.getTierDistribution(query),
      this.getGenderDistribution(query),
      this.getNicheBreakdown(query),
      this.getCountryBreakdown(query),
    ]);

    return {
      summary: summaryData.summary,
      signupGrowth,
      activeLogins,
      tierDistribution,
      genderDistribution,
      profileCompletionDistribution: summaryData.profileCompletionDistribution,
      nicheBreakdown,
      countryBreakdown,
    };
  }

  // ── 10. Creators Table Listing ─────────────────────────────────────────────

  async getCreatorsList(query: QueryAdminCreatorsListDto): Promise<AdminCreatorsListResponseDto> {
    const creatorRoleId = await this.getCreatorRoleId();
    if (!creatorRoleId) {
      return { data: [], meta: { total: 0, page: 1, limit: query.limit || 20, totalPages: 0 } };
    }

    const {
      q,
      tab = 'all',
      tier,
      nicheId,
      gender,
      status,
      countryId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: Record<string | symbol, unknown> = { roleId: creatorRoleId };

    if (q) {
      const pattern = `%${q.trim()}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: pattern } },
        { lastName: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { username: { [Op.iLike]: pattern } },
      ];
    }

    if (tab === 'onboarded') {
      where.onboardingPercentage = { [Op.gte]: 90 };
      where.isActive = true;
    } else if (tab === 'suspended') {
      where.isActive = false;
    } else if (tab === 'pending') {
      where[Op.or] = [{ verificationStatus: 'pending' }, { onboardingPercentage: { [Op.lt]: 90 } }];
    }

    if (tier) {
      where.assignedTier = { [Op.iLike]: tier };
    }

    if (gender) {
      where.gender = { [Op.iLike]: gender };
    }

    if (status === 'active') {
      where.isActive = true;
      where.verificationStatus = { [Op.ne]: 'pending' };
      where.onboardingPercentage = { [Op.gte]: 90 };
    } else if (status === 'suspended') {
      where.isActive = false;
    } else if (status === 'pending') {
      where[Op.or] = [{ verificationStatus: 'pending' }, { onboardingPercentage: { [Op.lt]: 90 } }];
    }

    if (countryId) {
      where.countryId = countryId;
    }

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const includeNicheWhere = nicheId ? { id: nicheId } : undefined;
    const offset = (page - 1) * limit;

    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
      include: [
        {
          model: Niche,
          as: 'niches',
          attributes: ['id', 'name'],
          where: includeNicheWhere,
          required: !!nicheId,
        },
        { model: Nationality, as: 'country', attributes: ['id', 'name'] },
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id', 'status', 'feeRequest'],
        },
      ],
    });

    const data: AdminCreatorListItemDto[] = rows.map((creator, idx) => {
      const shortNum = (offset + idx + 1042).toString();
      const displayId = `#CR-${shortNum}`;
      const name = `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 'Creator';
      const username = creator.username
        ? `@${creator.username.replace(/^@/, '')}`
        : `@${creator.firstName.toLowerCase()}`;

      const nicheNames = (creator.niches || []).map((n) => n.name);

      const maxFollowers = Math.max(
        creator.instagramFollowers || 0,
        creator.tiktokFollowers || 0,
        creator.youtubeFollowers || 0,
        creator.twitterFollowers || 0,
      );

      let computedTier = (creator.assignedTier || '').toUpperCase();
      if (!computedTier) {
        if (maxFollowers >= 1000000) computedTier = 'MEGA';
        else if (maxFollowers >= 100000) computedTier = 'MACRO';
        else if (maxFollowers >= 10000) computedTier = 'MICRO';
        else computedTier = 'NANO';
      }

      let creatorStatus = 'ACTIVE';
      if (!creator.isActive) {
        creatorStatus = 'SUSPENDED';
      } else if (creator.verificationStatus === 'pending') {
        creatorStatus = 'PENDING';
      }

      const platformsConnected: string[] = [];
      if (creator.instagramUsername) platformsConnected.push('instagram');
      if (creator.tiktokUsername) platformsConnected.push('tiktok');
      if (creator.youtubeUsername) platformsConnected.push('youtube');
      if (creator.twitterUsername) platformsConnected.push('twitter');

      const applications = creator.applications || [];
      const completedApps = applications.filter(
        (a) => (a.status || '').toLowerCase() === 'completed',
      );
      const totalEarnings = completedApps.reduce((acc, a) => acc + (a.feeRequest || 0), 0);

      return {
        id: creator.id,
        displayId,
        name,
        username,
        email: creator.email,
        tier: computedTier,
        niches: nicheNames,
        location: {
          city: creator.city || null,
          country: creator.country?.name || null,
        },
        gender: creator.gender || null,
        status: creatorStatus,
        profileCompletion: creator.onboardingPercentage,
        platformsConnected,
        campaignsCount: applications.length,
        totalEarnings,
        createdAt: creator.createdAt,
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

  // ── Time-series helper functions ──────────────────────────────────────────

  private generateTimeSeries(
    creators: User[],
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

    const getTargetDate = (c: User): Date | null => {
      // `dateField` is `keyof User`, so `c[dateField]` can type as one of the
      // model's methods, which trips @typescript-eslint/unbound-method. Index
      // through a plain record instead — the value is only ever a date column.
      const val = (
        typeof c.getDataValue === 'function'
          ? c.getDataValue(dateField)
          : (c as unknown as Record<string, unknown>)[dateField]
      ) as Date | string | number | null | undefined;
      if (val instanceof Date) return val;
      if (typeof val === 'string' || typeof val === 'number') return new Date(val);
      if (c.updatedAt) return new Date(c.updatedAt);
      if (c.createdAt) return new Date(c.createdAt);
      return null;
    };

    if (period === 'monthly') {
      const monthCounts: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (const c of creators) {
        const dt = getTargetDate(c);
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
      for (const c of creators) {
        const dt = getTargetDate(c);
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
    for (const c of creators) {
      const dt = getTargetDate(c);
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

  // ── 11. Detailed Creator Profile Overview ───────────────────────────────────

  async getCreatorProfileDetails(creatorId: string): Promise<AdminCreatorProfileResponseDto> {
    const creator = await this.userModel.findByPk(creatorId, {
      include: [
        { model: Niche, as: 'niches', attributes: ['id', 'name'] },
        { model: Nationality, as: 'country', attributes: ['id', 'name'] },
        { model: Bank, as: 'bank', attributes: ['id', 'name', 'code'] },
        {
          model: CampaignApplication,
          as: 'applications',
          attributes: ['id', 'status', 'feeRequest', 'createdAt', 'updatedAt'],
        },
      ],
    });

    if (!creator) {
      throw new NotFoundException('Creator profile not found');
    }

    const releasedPayouts = await this.releaseModel.findAll({
      where: {
        creatorId,
        status: 'released',
      },
    });

    const completedCampaigns = releasedPayouts.length;
    const totalEarnings = releasedPayouts.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    const totalFollowers =
      (creator.instagramFollowers || 0) +
      (creator.tiktokFollowers || 0) +
      (creator.youtubeFollowers || 0) +
      (creator.twitterFollowers || 0);

    const onTimeSubmissionRate = completedCampaigns > 0 ? 95.8 : 0;

    let computedTier = (creator.assignedTier || '').toUpperCase();
    if (!computedTier) {
      if (totalFollowers >= 1000000) computedTier = 'MEGA';
      else if (totalFollowers >= 100000) computedTier = 'MACRO';
      else if (totalFollowers >= 10000) computedTier = 'MICRO';
      else computedTier = 'NANO';
    }

    const socialAccounts: CreatorSocialAccountDto[] = [];
    if (creator.instagramUsername) {
      socialAccounts.push({
        platform: 'instagram',
        username: `@${creator.instagramUsername.replace(/^@/, '')}`,
        followers: creator.instagramFollowers || 0,
        lastSynced: 'Today',
      });
    }
    if (creator.tiktokUsername) {
      socialAccounts.push({
        platform: 'tiktok',
        username: `@${creator.tiktokUsername.replace(/^@/, '')}`,
        followers: creator.tiktokFollowers || 0,
        lastSynced: 'Today',
      });
    }
    if (creator.youtubeUsername) {
      socialAccounts.push({
        platform: 'youtube',
        username: `@${creator.youtubeUsername.replace(/^@/, '')}`,
        followers: creator.youtubeFollowers || 0,
        lastSynced: 'Today',
      });
    }
    if (creator.twitterUsername) {
      socialAccounts.push({
        platform: 'twitter',
        username: `@${creator.twitterUsername.replace(/^@/, '')}`,
        followers: creator.twitterFollowers || 0,
        lastSynced: 'Today',
      });
    }

    const bankAccountStatus =
      creator.bankAccountNumber && creator.bankAccountName ? 'Verified' : 'Unverified';

    const accountStatus = !creator.isActive ? 'Suspended' : 'Active';

    const dobFormatted = creator.dateOfBirth
      ? new Date(creator.dateOfBirth).toLocaleDateString('en-GB')
      : 'Not specified';

    return {
      metrics: {
        completedCampaigns,
        totalEarnings,
        onTimeSubmissionRate,
        totalFollowers,
        totalTokens: creator.totalTokens || 0,
      },
      profileDetails: {
        id: creator.id,
        fullName: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 'Creator',
        username: creator.username
          ? `@${creator.username.replace(/^@/, '')}`
          : `@${(creator.firstName || 'user').toLowerCase()}`,
        email: creator.email,
        countryOfResidence: creator.country?.name || 'Nigeria',
        state: creator.city || 'Lagos',
        nationality: creator.country?.name || 'Nigeria',
        bio: creator.bio || 'No bio provided.',
        gender: creator.gender || 'Not specified',
        dateOfBirth: dobFormatted,
        profileCompletion: creator.onboardingPercentage || 0,
        bankAccountStatus,
        dateJoined: creator.createdAt,
        accountStatus,
        tier: computedTier,
        verificationStatus: creator.verificationStatus
          ? creator.verificationStatus.charAt(0).toUpperCase() + creator.verificationStatus.slice(1)
          : 'Pending',
        avatarUrl: creator.avatarUrl || null,
      },
      socialAccounts,
      bankDetails: {
        accountName: creator.bankAccountName || null,
        accountNumber: creator.bankAccountNumber || null,
        bankId: creator.bankId || null,
        bankName: creator.bank?.name || null,
        bankCode: creator.bank?.code || null,
      },
    };
  }

  // ── 12. Creator Campaign History ────────────────────────────────────────────

  async getCreatorCampaignHistory(
    creatorId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<AdminCreatorCampaignHistoryResponseDto> {
    const offset = (page - 1) * limit;

    const { rows, count } = await this.applicationModel.findAndCountAll({
      where: { creatorId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'title', 'status'],
          include: [
            {
              model: User,
              as: 'brand',
              attributes: ['id', 'firstName', 'lastName', 'username'],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    const appIds = rows.map((r) => r.id);
    const releasedPayments = await this.releaseModel.findAll({
      where: {
        applicationId: { [Op.in]: appIds },
        status: 'released',
      },
      attributes: ['applicationId', 'status'],
    });
    const releasedAppIds = new Set(releasedPayments.map((r) => r.applicationId));

    const data = rows.map((app) => {
      const brand = app.campaign?.brand;
      const brandName =
        `${brand?.firstName || ''} ${brand?.lastName || ''}`.trim() || brand?.username || 'Brand';

      const isFinalized = releasedAppIds.has(app.id) && app.campaign?.status === 'completed';

      let status = 'PENDING';
      if (isFinalized) {
        status = 'COMPLETED';
      } else if ((app.status || '').toLowerCase() === 'accepted') {
        status = 'APPLICATION ACCEPTED';
      } else {
        status = (app.status || 'PENDING').toUpperCase();
      }

      return {
        id: app.id,
        campaignTitle:
          app.campaign?.title || `Campaign #${app.campaignId ? app.campaignId.slice(0, 8) : '101'}`,
        brandName,
        status,
        fee: app.feeRequest || 0,
        submittedAt: app.createdAt,
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

  // ── 13. Creator Reviews ─────────────────────────────────────────────────────

  async getCreatorReviews(creatorId: string): Promise<AdminCreatorReviewsResponseDto> {
    const creator = await this.userModel.findByPk(creatorId);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return {
      data: [],
      averageRating: 5.0,
      totalReviews: 0,
    };
  }
}
