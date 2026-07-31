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

const X_API_BASE = 'https://api.x.com/2';

/**
 * X (Twitter) post metrics.
 *
 * `public_metrics` carries likes/replies/retweets/quotes plus bookmark and
 * impression counts. impression_count is only populated for tweets authored
 * by the authenticating user, which is exactly our case — and also means a
 * populated value is itself evidence of ownership.
 */
@Injectable()
export class TwitterInsightsService implements PostInsightsProvider {
  readonly platform = SocialPlatform.TWITTER;
  private readonly logger = new Logger(TwitterInsightsService.name);

  async resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null> {
    const tweetId = extractTweetId(url);
    if (!tweetId) return null;

    const body = await this.get(
      `${X_API_BASE}/tweets/${tweetId}?tweet.fields=author_id,created_at`,
      ctx.accessToken,
      'tweet lookup',
    );

    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const authorId = data.author_id as string | undefined;
    if (!authorId) return null;

    const ownId = ctx.platformUserId ?? (await this.fetchOwnUserId(ctx.accessToken));
    if (!ownId || authorId !== ownId) return null;

    return {
      platformMediaId: tweetId,
      mediaType: 'TWEET',
      publishedAt: data.created_at ? new Date(data.created_at as string) : null,
    };
  }

  async fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights> {
    const insights = emptyInsights();

    const body = await this.get(
      `${X_API_BASE}/tweets/${platformMediaId}?tweet.fields=public_metrics`,
      ctx.accessToken,
      'tweet metrics',
    );

    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    const metrics = (data.public_metrics as Record<string, unknown> | undefined) ?? {};

    insights.views = toCount(metrics.impression_count);
    insights.likes = toCount(metrics.like_count);
    insights.comments = toCount(metrics.reply_count);

    // "Shares" on X is retweets plus quote tweets — both redistribute the post.
    const retweets = toCount(metrics.retweet_count);
    const quotes = toCount(metrics.quote_count);
    insights.shares = retweets === null && quotes === null ? null : (retweets ?? 0) + (quotes ?? 0);

    insights.saves = toCount(metrics.bookmark_count);

    // X publishes no unique-reach metric; impression_count is total, not unique.
    markUnsupported(insights, ['reach'], 'X exposes only total impressions, not unique reach');

    insights.raw = body;
    return insights;
  }

  private async fetchOwnUserId(accessToken: string): Promise<string | null> {
    const body = await this.get(`${X_API_BASE}/users/me`, accessToken, 'own user lookup');
    const data = (body.data as Record<string, unknown> | undefined) ?? {};
    return (data.id as string | undefined) ?? null;
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
      this.logger.warn(`X ${what} failed: Status ${response.status} - ${text}`);
      if (response.status === 401 || response.status === 403) {
        throw new InsightsAuthError(`X rejected the stored token while fetching ${what}`);
      }
      throw new Error(`X ${what} failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

/** Matches x.com and twitter.com status URLs. */
export function extractTweetId(url: string): string | null {
  const match = /(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i.exec(url);
  return match ? match[1] : null;
}
