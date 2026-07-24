import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BannerAd } from '../entities/banner-ad.entity';
import { QueryBannerAdsDto, CreateBannerAdDto, UpdateBannerAdDto } from '../dtos/banner-ad.dto';

@Injectable()
export class BannerAdRepository {
  constructor(
    @InjectModel(BannerAd)
    private readonly bannerAdModel: typeof BannerAd,
  ) {}

  async create(dto: CreateBannerAdDto): Promise<BannerAd> {
    return this.bannerAdModel.create({
      title: dto.title,
      adType: dto.adType,
      targetAudience: dto.targetAudience,
      placement: dto.placement,
      adImageUrl: dto.adImageUrl,
      linkUrl: dto.linkUrl,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status || 'draft',
    } as unknown as BannerAd);
  }

  async findById(id: string): Promise<BannerAd | null> {
    return this.bannerAdModel.findByPk(id);
  }

  async update(id: string, dto: UpdateBannerAdDto): Promise<BannerAd | null> {
    const ad = await this.findById(id);
    if (!ad) return null;

    const updatePayload: Record<string, any> = {};
    if (dto.title !== undefined) updatePayload.title = dto.title;
    if (dto.adType !== undefined) updatePayload.adType = dto.adType;
    if (dto.targetAudience !== undefined) updatePayload.targetAudience = dto.targetAudience;
    if (dto.placement !== undefined) updatePayload.placement = dto.placement;
    if (dto.adImageUrl !== undefined) updatePayload.adImageUrl = dto.adImageUrl;
    if (dto.linkUrl !== undefined) updatePayload.linkUrl = dto.linkUrl;
    if (dto.startDate !== undefined)
      updatePayload.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined)
      updatePayload.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.status !== undefined) updatePayload.status = dto.status;

    await ad.update(updatePayload);
    return ad;
  }

  async updateStatus(id: string, status: string): Promise<BannerAd | null> {
    const ad = await this.findById(id);
    if (!ad) return null;
    await ad.update({ status });
    return ad;
  }

  async delete(id: string): Promise<boolean> {
    const deletedCount = await this.bannerAdModel.destroy({ where: { id } });
    return deletedCount > 0;
  }

  async findAll(
    query: QueryBannerAdsDto,
  ): Promise<{ data: BannerAd[]; total: number; page: number; limit: number }> {
    const { status, placement, search, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const whereClause: Record<string, any> = {};

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.title = { [Op.iLike]: `%${search}%` };
    }

    // JSONB array check for placement if provided
    if (placement) {
      whereClause.placement = { [Op.contains]: [placement] };
    }

    const { rows, count } = await this.bannerAdModel.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
    };
  }

  async findActiveAdsForUser(placement?: string): Promise<BannerAd[]> {
    const now = new Date();
    const whereClause: Record<string, any> = {
      status: { [Op.in]: ['active', 'scheduled'] },
      [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: now } }],
      [Op.and]: [{ [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: now } }] }],
    };

    if (placement) {
      whereClause.placement = { [Op.contains]: [placement] };
    }

    return this.bannerAdModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
  }

  async incrementImpressions(id: string): Promise<void> {
    await this.bannerAdModel.increment('impressions', { by: 1, where: { id } });
  }

  async incrementClicks(id: string): Promise<void> {
    await this.bannerAdModel.increment('clicks', { by: 1, where: { id } });
  }

  async getSummaryMetrics(): Promise<{
    totalActive: number;
    totalImpressions: number;
    totalClicks: number;
    adsExpiringSoon: number;
  }> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalActive = await this.bannerAdModel.count({ where: { status: 'active' } });
    const totalImpressions = (await this.bannerAdModel.sum('impressions')) || 0;
    const totalClicks = (await this.bannerAdModel.sum('clicks')) || 0;

    const adsExpiringSoon = await this.bannerAdModel.count({
      where: {
        status: 'active',
        endDate: {
          [Op.gte]: now,
          [Op.lte]: sevenDaysFromNow,
        },
      },
    });

    return {
      totalActive,
      totalImpressions,
      totalClicks,
      adsExpiringSoon,
    };
  }
}
