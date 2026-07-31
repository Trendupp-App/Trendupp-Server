import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '../../../domains/socials/constants/social-platforms';
import { YOUTUBE_ANALYTICS_MIN_WINDOW } from '../../../domains/post-metrics/post-metrics.constants';
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

const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';

/**
 * YouTube needs two APIs:
 *
 *  - Data API v3 `videos.list` — real-time viewCount/likeCount/commentCount,
 *    public, no ownership needed.
 *  - Analytics API — the ONLY source of `shares` and `videosAddedToPlaylists`,
 *    but day-bucketed with 2-3 days of settling latency, so a T+24h read is
 *    materially under-reported.
 *
 * So the early window uses the real-time counters alone and Analytics joins
 * from T+7d. See YOUTUBE_ANALYTICS_MIN_WINDOW.
 */
@Injectable()
export class YoutubeInsightsService implements PostInsightsProvider {
  readonly platform = SocialPlatform.YOUTUBE;
  private readonly logger = new Logger(YoutubeInsightsService.name);

  /**
   * The video id is parseable from the URL, but that proves nothing — so we
   * confirm the video's channel matches the connected channel. `mine=true` on
   * channels.list gives the authoritative owner id.
   */
  async resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null> {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) return null;

    const body = await this.get(
      `${YT_DATA_BASE}/videos?part=snippet&id=${encodeURIComponent(videoId)}`,
      ctx.accessToken,
      'video lookup',
    );

    const items = (body.items as Array<Record<string, unknown>> | undefined) ?? [];
    if (items.length === 0) return null;

    const snippet = (items[0].snippet as Record<string, unknown> | undefined) ?? {};
    const videoChannelId = snippet.channelId as string | undefined;

    const ownChannelId = ctx.platformUserId ?? (await this.fetchOwnChannelId(ctx.accessToken));
    if (!ownChannelId || !videoChannelId || ownChannelId !== videoChannelId) return null;

    return {
      platformMediaId: videoId,
      mediaType: 'VIDEO',
      publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt as string) : null,
    };
  }

  async fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights> {
    const insights = emptyInsights();

    const statsBody = await this.get(
      `${YT_DATA_BASE}/videos?part=statistics&id=${encodeURIComponent(platformMediaId)}`,
      ctx.accessToken,
      'video statistics',
    );

    const items = (statsBody.items as Array<Record<string, unknown>> | undefined) ?? [];
    const statistics = (items[0]?.statistics as Record<string, unknown> | undefined) ?? {};

    insights.views = toCount(statistics.viewCount);
    insights.likes = toCount(statistics.likeCount);
    insights.comments = toCount(statistics.commentCount);

    // YouTube has no unique-reach metric; Studio's "Impressions" is not
    // exposed through the public Analytics API.
    markUnsupported(insights, ['reach'], 'YouTube exposes no unique reach metric');

    const analyticsUsable = ctx.windowLabel !== 't24h';
    if (!analyticsUsable) {
      const detail =
        'YouTube Analytics data is day-bucketed and takes 2-3 days to settle; ' +
        `available from the ${YOUTUBE_ANALYTICS_MIN_WINDOW} capture onward`;
      insights.unavailableMetrics.push({ metric: 'shares', reason: 'fetch_failed', detail });
      insights.unavailableMetrics.push({ metric: 'saves', reason: 'fetch_failed', detail });
      insights.raw = { statistics: statsBody };
      return insights;
    }

    let analyticsBody: Record<string, unknown> | null = null;
    try {
      analyticsBody = await this.fetchAnalytics(platformMediaId, ctx.accessToken);
      const values = parseAnalyticsRow(analyticsBody);
      insights.shares = values.shares ?? null;
      insights.saves = values.videosAddedToPlaylists ?? null;
    } catch (error) {
      if (error instanceof InsightsAuthError) throw error;
      // The real-time counters already succeeded; degrade the two
      // Analytics-only metrics rather than losing the whole snapshot.
      this.logger.warn(
        `YouTube Analytics unavailable for ${platformMediaId}: ${(error as Error).message}`,
      );
      const detail = 'YouTube Analytics request failed for this capture';
      insights.unavailableMetrics.push({ metric: 'shares', reason: 'fetch_failed', detail });
      insights.unavailableMetrics.push({ metric: 'saves', reason: 'fetch_failed', detail });
    }

    insights.raw = { statistics: statsBody, analytics: analyticsBody };
    return insights;
  }

  private async fetchAnalytics(
    videoId: string,
    accessToken: string,
  ): Promise<Record<string, unknown>> {
    // Analytics requires an explicit date range. Anchor the start well before
    // any plausible publish date and let YouTube clamp it.
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 400 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: toYmd(startDate),
      endDate: toYmd(endDate),
      metrics: 'views,likes,comments,shares,videosAddedToPlaylists,estimatedMinutesWatched',
      filters: `video==${videoId}`,
    });

    return this.get(`${YT_ANALYTICS_BASE}/reports?${params.toString()}`, accessToken, 'analytics');
  }

  private async fetchOwnChannelId(accessToken: string): Promise<string | null> {
    const body = await this.get(
      `${YT_DATA_BASE}/channels?part=id&mine=true`,
      accessToken,
      'own channel lookup',
    );
    const items = (body.items as Array<Record<string, unknown>> | undefined) ?? [];
    return (items[0]?.id as string | undefined) ?? null;
  }

  private async get(
    url: string,
    accessToken: string,
    what: string,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`YouTube ${what} failed: Status ${response.status} - ${text}`);

      // 403 covers both "scope not granted" (insufficientPermissions) and
      // quota exhaustion — only the former needs a reconnect.
      if (response.status === 401 || /insufficientPermissions|forbidden/i.test(text)) {
        throw new InsightsAuthError(
          `YouTube rejected the stored token while fetching ${what} — the ` +
            'yt-analytics.readonly scope may not be granted',
        );
      }
      throw new Error(`YouTube ${what} failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

/** Analytics returns `{ columnHeaders: [{name}], rows: [[...]] }`. */
function parseAnalyticsRow(body: Record<string, unknown>): Record<string, number | null> {
  const headers = (body.columnHeaders as Array<Record<string, unknown>> | undefined) ?? [];
  const rows = (body.rows as unknown[][] | undefined) ?? [];
  const row = rows[0];
  if (!row) return {};

  const out: Record<string, number | null> = {};
  headers.forEach((header, index) => {
    const name = header.name as string | undefined;
    if (name) out[name] = toCount(row[index]);
  });
  return out;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Accepts watch URLs, youtu.be short links, /shorts/, /live/ and /embed/.
 * Shorts matter here — they are the dominant creator format.
 */
export function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return match[1];
  }
  return null;
}
