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

const GRAPH_BASE = 'https://graph.facebook.com/v23.0';

interface FacebookPage {
  id: string;
  name?: string;
  access_token?: string;
}

/**
 * Facebook Page post insights.
 *
 * The stored connection token is a USER token, but post insights require the
 * token of the Page that owns the post — so every call first exchanges the
 * user token for the Page tokens via /me/accounts (needs pages_show_list),
 * then finds the Page that actually owns the submitted post. That search is
 * the ownership proof.
 */
@Injectable()
export class FacebookInsightsService implements PostInsightsProvider {
  readonly platform = SocialPlatform.FACEBOOK;
  private readonly logger = new Logger(FacebookInsightsService.name);

  async resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null> {
    const postRef = extractFacebookPostRef(url);
    if (!postRef) return null;

    const pages = await this.fetchPages(ctx.accessToken);

    for (const page of pages) {
      if (!page.access_token) continue;

      // A post id is `<pageId>_<postId>`. When the URL carried only the post
      // half, pair it with each managed page until one resolves.
      const candidateId = postRef.includes('_') ? postRef : `${page.id}_${postRef}`;
      if (postRef.includes('_') && !postRef.startsWith(`${page.id}_`)) continue;

      const body = await this.tryGet(
        `${GRAPH_BASE}/${candidateId}?fields=id,created_time&access_token=${encodeURIComponent(
          page.access_token,
        )}`,
      );
      if (!body || !body.id) continue;

      return {
        platformMediaId: candidateId,
        mediaType: 'PAGE_POST',
        publishedAt: body.created_time ? new Date(body.created_time as string) : null,
      };
    }

    return null;
  }

  async fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights> {
    const insights = emptyInsights();

    const pageId = platformMediaId.split('_')[0];
    const pages = await this.fetchPages(ctx.accessToken);
    const page = pages.find((p) => p.id === pageId);

    if (!page?.access_token) {
      throw new InsightsAuthError(
        'The Facebook Page that owns this post is no longer managed by the connected account',
      );
    }

    const token = encodeURIComponent(page.access_token);

    // Engagement counters come off the post object as summary counts.
    const fields = [
      'id',
      'shares',
      'likes.summary(true).limit(0)',
      'comments.summary(true).limit(0)',
    ].join(',');

    const postBody = await this.get(
      `${GRAPH_BASE}/${platformMediaId}?fields=${fields}&access_token=${token}`,
      'post counters',
    );

    insights.likes = toCount(
      ((postBody.likes as Record<string, any> | undefined)?.summary as Record<string, unknown>)
        ?.total_count,
    );
    insights.comments = toCount(
      ((postBody.comments as Record<string, any> | undefined)?.summary as Record<string, unknown>)
        ?.total_count,
    );
    insights.shares = toCount((postBody.shares as Record<string, unknown> | undefined)?.count);

    // post_impressions_unique is Facebook's unique-reach metric for a post.
    const metrics = ['post_impressions_unique', 'post_impressions', 'post_video_views'];
    const insightsBody = await this.get(
      `${GRAPH_BASE}/${platformMediaId}/insights?metric=${metrics.join(',')}&access_token=${token}`,
      'post insights',
    );

    const values = parseInsightsEdge(insightsBody);
    insights.reach = values.post_impressions_unique ?? null;
    insights.views = values.post_video_views ?? values.post_impressions ?? null;

    // Facebook has no save/bookmark metric for Page posts on any API surface.
    markUnsupported(insights, ['saves'], 'Facebook exposes no saves metric for Page posts');

    insights.raw = { post: postBody, insights: insightsBody };
    return insights;
  }

  private async fetchPages(userAccessToken: string): Promise<FacebookPage[]> {
    const body = await this.get(
      `${GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(
        userAccessToken,
      )}`,
      'managed pages',
    );
    return (body.data as FacebookPage[] | undefined) ?? [];
  }

  /** Probe request where a 4xx is an expected "not this page" answer. */
  private async tryGet(url: string): Promise<Record<string, unknown> | null> {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  }

  private async get(url: string, what: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Facebook ${what} failed: Status ${response.status} - ${text}`);
      if (response.status === 401 || /OAuthException|"code"\s*:\s*(190|102|463)/i.test(text)) {
        throw new InsightsAuthError(
          `Facebook rejected the stored token while fetching ${what} — pages_read_engagement ` +
            'and read_insights may not be granted',
        );
      }
      throw new Error(`Facebook ${what} failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

/** `{ data: [{ name, values: [{ value }] }] }` → flat map. */
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

/**
 * Facebook post URLs come in several shapes:
 *   /<page>/posts/<postId>
 *   /permalink.php?story_fbid=<postId>&id=<pageId>
 *   /<pageId>/posts/<pageId>_<postId>
 *   /reel/<id>  /videos/<id>
 *
 * Returns either a bare post id or a full `<pageId>_<postId>` composite.
 */
export function extractFacebookPostRef(url: string): string | null {
  const storyFbid = /[?&]story_fbid=(\d+)/i.exec(url);
  const pageId = /[?&]id=(\d+)/i.exec(url);
  if (storyFbid && pageId) return `${pageId[1]}_${storyFbid[1]}`;
  if (storyFbid) return storyFbid[1];

  const composite = /facebook\.com\/[^/]+\/posts\/(\d+_\d+)/i.exec(url);
  if (composite) return composite[1];

  const posts = /facebook\.com\/[^/]+\/posts\/(?:pfbid[A-Za-z0-9]+|(\d+))/i.exec(url);
  if (posts?.[1]) return posts[1];

  const media = /facebook\.com\/(?:[^/]+\/)?(?:videos|reel)\/(\d+)/i.exec(url);
  if (media) return media[1];

  return null;
}
