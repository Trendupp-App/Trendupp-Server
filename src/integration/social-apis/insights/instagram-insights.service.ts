import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '../../../domains/socials/constants/social-platforms';
import { INSTAGRAM_VIEWLESS_MEDIA_TYPES } from '../../../domains/post-metrics/post-metrics.constants';
import {
  InsightsAuthError,
  InsightsFetchContext,
  PostInsights,
  PostInsightsProvider,
  ResolvedPostMedia,
  emptyInsights,
  toCount,
} from './post-insights.types';

/**
 * Instagram API with Instagram Login. The path MUST be versioned — the
 * versionless host returns the misleading IGApiException "Unsupported
 * request - method type: get" (code 100). Same trap as InstagramAuthService.
 */
const IG_GRAPH_BASE = 'https://graph.instagram.com/v25.0';

/** How far back through the creator's media we look for the submitted URL. */
const MEDIA_SCAN_PAGES = 5;
const MEDIA_PAGE_SIZE = 50;

interface IgMediaNode {
  id: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
}

@Injectable()
export class InstagramInsightsService implements PostInsightsProvider {
  readonly platform = SocialPlatform.INSTAGRAM;
  private readonly logger = new Logger(InstagramInsightsService.name);

  /**
   * Instagram exposes no "lookup media by shortcode" endpoint, so the only
   * way to tie a submitted permalink to a media id is to page the creator's
   * own /me/media and match on permalink. That constraint is what makes the
   * match proof of ownership.
   */
  async resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null> {
    const shortcode = extractInstagramShortcode(url);
    if (!shortcode) return null;

    const fields = 'id,permalink,media_type,media_product_type,timestamp';
    let next: string | null =
      `${IG_GRAPH_BASE}/me/media?fields=${fields}&limit=${MEDIA_PAGE_SIZE}` +
      `&access_token=${encodeURIComponent(ctx.accessToken)}`;

    for (let page = 0; page < MEDIA_SCAN_PAGES && next; page += 1) {
      const body = await this.request(next, 'media listing');
      const data = (body.data as IgMediaNode[] | undefined) ?? [];

      for (const node of data) {
        if (!node.permalink) continue;
        if (extractInstagramShortcode(node.permalink) !== shortcode) continue;

        return {
          platformMediaId: node.id,
          // media_product_type distinguishes REELS / STORY / FEED; media_type
          // distinguishes IMAGE / VIDEO / CAROUSEL_ALBUM. The product type is
          // the more useful of the two for capture scheduling.
          mediaType: node.media_product_type ?? node.media_type ?? null,
          publishedAt: node.timestamp ? new Date(node.timestamp) : null,
        };
      }

      const paging = (body.paging as Record<string, unknown> | undefined) ?? {};
      next = (paging.next as string | undefined) ?? null;
    }

    return null;
  }

  async fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights> {
    const insights = emptyInsights();

    // Counters live on the media object; reach/saved/shares/views come from
    // the insights edge. Two calls, because the edge does not carry likes.
    const mediaFields = 'id,media_type,media_product_type,like_count,comments_count';
    const mediaBody = await this.request(
      `${IG_GRAPH_BASE}/${platformMediaId}?fields=${mediaFields}` +
        `&access_token=${encodeURIComponent(ctx.accessToken)}`,
      'media counters',
    );

    insights.likes = toCount(mediaBody.like_count);
    insights.comments = toCount(mediaBody.comments_count);

    const mediaType = (mediaBody.media_type as string | undefined) ?? ctx.mediaType ?? undefined;

    // `impressions` and `video_views` were removed in v22.0 in favour of `views`.
    const wanted = ['reach', 'saved', 'shares', 'total_interactions'];
    const viewsSupported = !INSTAGRAM_VIEWLESS_MEDIA_TYPES.has(mediaType ?? '');
    if (viewsSupported) wanted.unshift('views');

    if (!viewsSupported) {
      insights.unavailableMetrics.push({
        metric: 'views',
        reason: 'not_supported_for_media_type',
        detail: 'Videos inside an Instagram carousel always report 0 views',
      });
    }

    const insightsBody = await this.request(
      `${IG_GRAPH_BASE}/${platformMediaId}/insights?metric=${wanted.join(',')}` +
        `&access_token=${encodeURIComponent(ctx.accessToken)}`,
      'media insights',
    );

    const values = parseInsightsEdge(insightsBody);
    if (viewsSupported) insights.views = values.views ?? null;
    insights.reach = values.reach ?? null;
    insights.saves = values.saved ?? null;
    insights.shares = values.shares ?? null;

    insights.raw = { media: mediaBody, insights: insightsBody };
    return insights;
  }

  private async request(url: string, what: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Instagram ${what} failed: Status ${response.status} - ${text}`);

      // 400 with an OAuth subcode, or any 401/403, means the creator must
      // reconnect (expired long-lived token, revoked, or the insights scope
      // was never granted). Anything else is a transient platform failure.
      if (response.status === 401 || response.status === 403 || isIgAuthError(text)) {
        throw new InsightsAuthError(`Instagram rejected the stored token while fetching ${what}`);
      }
      throw new Error(`Instagram ${what} failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

/**
 * The insights edge returns
 * `{ data: [{ name, values: [{ value }] }, ...] }` — flatten it to a map.
 */
function parseInsightsEdge(body: Record<string, unknown>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const data = (body.data as Array<Record<string, unknown>> | undefined) ?? [];

  for (const entry of data) {
    const name = entry.name as string | undefined;
    if (!name) continue;
    const values = (entry.values as Array<Record<string, unknown>> | undefined) ?? [];
    out[name] = toCount(values[0]?.value);
  }
  return out;
}

/** Instagram signals auth problems via error.type / error.code, not status alone. */
function isIgAuthError(text: string): boolean {
  return /OAuthException|"code"\s*:\s*(190|102|463|467)/i.test(text);
}

/**
 * Pull the shortcode out of an Instagram permalink: /p/<code>/,
 * /reel/<code>/, /reels/<code>/, /tv/<code>/.
 *
 * `/share/<code>` links are deliberately NOT matched: their code is an opaque
 * redirect token that never equals the permalink shortcode, so comparing it
 * would report a genuine post as "not owned by this creator". Returning null
 * routes those to `unsupported` instead, which asks the creator for a direct
 * permalink rather than accusing them.
 */
export function extractInstagramShortcode(url: string): string | null {
  const match = /instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i.exec(url);
  return match ? match[1] : null;
}
