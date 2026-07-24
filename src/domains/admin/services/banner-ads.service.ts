import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BannerAdRepository } from '../repository/banner-ad.repository';
import { BannerAd } from '../entities/banner-ad.entity';
import {
  CreateBannerAdDto,
  UpdateBannerAdDto,
  QueryBannerAdsDto,
  BannerAdSummaryResponseDto,
} from '../dtos/banner-ad.dto';

@Injectable()
export class BannerAdsService {
  // In-memory 5-minute impression deduplication cache: key -> timestamp
  private impressionCache = new Map<string, number>();

  constructor(private readonly bannerAdRepository: BannerAdRepository) {}

  async createAd(dto: CreateBannerAdDto): Promise<BannerAd> {
    return this.bannerAdRepository.create(dto);
  }

  async getAdById(id: string): Promise<BannerAd> {
    const ad = await this.bannerAdRepository.findById(id);
    if (!ad) {
      throw new NotFoundException(`Banner Ad with ID ${id} not found.`);
    }
    return ad;
  }

  async updateAd(id: string, dto: UpdateBannerAdDto): Promise<BannerAd> {
    await this.getAdById(id);
    const updated = await this.bannerAdRepository.update(id, dto);
    if (!updated) {
      throw new BadRequestException('Failed to update Banner Ad.');
    }
    return updated;
  }

  async updateAdStatus(id: string, status: string): Promise<BannerAd> {
    await this.getAdById(id);
    const updated = await this.bannerAdRepository.updateStatus(id, status);
    if (!updated) {
      throw new BadRequestException('Failed to update Banner Ad status.');
    }
    return updated;
  }

  async deleteAd(id: string): Promise<void> {
    await this.getAdById(id);
    await this.bannerAdRepository.delete(id);
  }

  async getAdminAdsList(query: QueryBannerAdsDto) {
    return this.bannerAdRepository.findAll(query);
  }

  async getAdminAdsSummary(): Promise<BannerAdSummaryResponseDto> {
    const metrics = await this.bannerAdRepository.getSummaryMetrics();

    const formatNumber = (num: number): string => {
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
      if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
      return num.toString();
    };

    const ctr =
      metrics.totalImpressions > 0
        ? ((metrics.totalClicks / metrics.totalImpressions) * 100).toFixed(1) + '%'
        : '0.0%';

    return {
      totalActiveAds: metrics.totalActive,
      totalImpressions: formatNumber(metrics.totalImpressions),
      clickThroughRate: ctr,
      adsExpiringSoon: metrics.adsExpiringSoon,
    };
  }

  // ─── Public / User Facing Methods ──────────────────────────────────────────

  async getActiveAdsForUser(placement?: string): Promise<BannerAd[]> {
    return this.bannerAdRepository.findActiveAdsForUser(placement);
  }

  async recordImpression(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; deduplicated: boolean }> {
    await this.getAdById(id);

    const cacheKey = `ad_imp:${userId}:${id}`;
    const lastTime = this.impressionCache.get(cacheKey);
    const now = Date.now();
    const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

    if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
      return { success: true, deduplicated: true };
    }

    this.impressionCache.set(cacheKey, now);
    await this.bannerAdRepository.incrementImpressions(id);

    // Clean up cache entries older than 10 minutes to prevent memory growth
    if (this.impressionCache.size > 10000) {
      for (const [k, v] of this.impressionCache.entries()) {
        if (now - v > 10 * 60 * 1000) {
          this.impressionCache.delete(k);
        }
      }
    }

    return { success: true, deduplicated: false };
  }

  async recordClick(id: string): Promise<{ success: boolean; linkUrl?: string | null }> {
    const ad = await this.getAdById(id);
    await this.bannerAdRepository.incrementClicks(id);
    return {
      success: true,
      linkUrl: ad.linkUrl,
    };
  }
}
