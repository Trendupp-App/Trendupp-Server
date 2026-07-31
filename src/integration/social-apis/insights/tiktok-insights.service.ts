import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '../../../domains/socials/constants/social-platforms';
import {
  InsightsAuthError,
  InsightsFetchContext,
  PostInsights,
  PostInsightsProvider,
  ResolvedPostMedia,
  emptyInsights,
  markUnsupported,
  toCount,
} from './post-insights.types';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

/** Video listing is paged; cap the scan so one bad URL cannot loop forever. */
const VIDEO_SCAN_PAGES = 5;
const VIDEO_PAGE_SIZE = 20;

const VIDEO_FIELDS = [
  'id',
  'create_time',
  'share_url',
  'embed_link',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',');

interface TiktokVideoNode {
  id: string;
  create_time?: number;
  share_url?: string;
  embed_link?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  /** Saves/favourites. Only returned for some apps, hence optional. */
  collect_count?: number;
}

@Injectable()
export class TiktokInsightsService implements PostInsightsProvider {
  readonly platform = SocialPlatform.TIKTOK;
  private readonly logger = new Logger(TiktokInsightsService.name);

  /**
   * The Display API has no "get video by url" endpoint, so we page
   * /video/list/ (scope `video.list`) and match the id embedded in the
   * submitted share URL. As with Instagram, finding it in the creator's own
   * list is what proves ownership.
   */
  async resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null> {
    const videoId = extractTiktokVideoId(url);
    if (!videoId) return null;

    let cursor: number | undefined;

    for (let page = 0; page < VIDEO_SCAN_PAGES; page += 1) {
      const body = await this.request(
        `${TIKTOK_API_BASE}/video/list/?fields=${VIDEO_FIELDS}`,
        ctx.accessToken,
        { max_count: VIDEO_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        'video listing',
      );

      const data = (body.data as Record<string, unknown> | undefined) ?? {};
      const videos = (data.videos as TiktokVideoNode[] | undefined) ?? [];

      const match = videos.find(
        (v) => v.id === videoId || extractTiktokVideoId(v.share_url ?? '') === videoId,
      );
      if (match) {
        return {
          platformMediaId: match.id,
          mediaType: 'VIDEO', // TikTok has no other post type on this API
          publishedAt: match.create_time ? new Date(match.create_time * 1000) : null,
        };
      }

      if (!data.has_more) break;
      cursor = data.cursor as number | undefined;
      if (cursor === undefined) break;
    }

    return null;
  }

  async fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights> {
    const insights = emptyInsights();

    // /video/query/ fetches specific ids, avoiding a re-scan of the whole list.
    const body = await this.request(
      `${TIKTOK_API_BASE}/video/query/?fields=${VIDEO_FIELDS},collect_count`,
      ctx.accessToken,
      { filters: { video_ids: [platformMediaId] } },
      'video query',
    );

    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const videos = (data.videos as TiktokVideoNode[] | undefined) ?? [];
    const video = videos[0];

    if (video) {
      insights.views = toCount(video.view_count);
      insights.likes = toCount(video.like_count);
      insights.comments = toCount(video.comment_count);
      insights.shares = toCount(video.share_count);
      insights.saves = toCount(video.collect_count);

      if (insights.saves === null) {
        insights.unavailableMetrics.push({
          metric: 'saves',
          reason: 'not_supported',
          detail: 'TikTok did not return collect_count for this app',
        });
      }
    }

    // TikTok publishes no unique-reach metric on any API surface.
    markUnsupported(insights, ['reach'], 'TikTok exposes no unique reach metric');

    insights.raw = body;
    return insights;
  }

  private async request(
    url: string,
    accessToken: string,
    payload: Record<string, unknown>,
    what: string,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      this.logger.warn(
        `TikTok ${what} failed: Status ${response.status} - ${JSON.stringify(body)}`,
      );
      if (response.status === 401 || response.status === 403) {
        throw new InsightsAuthError(`TikTok rejected the stored token while fetching ${what}`);
      }
      throw new Error(`TikTok ${what} failed with status ${response.status}`);
    }

    // TikTok returns HTTP 200 with an error object for scope problems, so the
    // body must be inspected even on success.
    const error = (body.error as Record<string, unknown> | undefined) ?? {};
    const code = (error.code as string | undefined) ?? 'ok';
    if (code !== 'ok') {
      this.logger.warn(`TikTok ${what} returned error code ${code}: ${JSON.stringify(error)}`);
      if (/scope|permission|token/i.test(code)) {
        throw new InsightsAuthError(
          `TikTok returned "${code}" — the video.list scope is likely not granted`,
        );
      }
      throw new Error(`TikTok ${what} returned error code ${code}`);
    }

    return body;
  }
}

/**
 * TikTok share URLs carry the numeric video id:
 * https://www.tiktok.com/@handle/video/1234567890123456789
 *
 * Short vm.tiktok.com / vt.tiktok.com links do NOT, and resolving them would
 * mean following an untrusted redirect, so they are rejected and the creator
 * is asked for the full URL.
 */
export function extractTiktokVideoId(url: string): string | null {
  const match = /tiktok\.com\/@[^/]+\/video\/(\d+)/i.exec(url);
  return match ? match[1] : null;
}
