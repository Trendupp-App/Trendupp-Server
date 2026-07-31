import { SocialPlatform } from '../../../domains/socials/constants/social-platforms';
import { MetricUnavailable, MetricKey } from '../../../domains/post-metrics/post-metrics.constants';

/**
 * A post resolved against the creator's OWN account listing.
 *
 * Providers only ever return this after finding the URL inside the connected
 * account's media — a media id parsed out of a URL alone proves nothing, and
 * every insights API refuses third-party media anyway.
 */
export interface ResolvedPostMedia {
  platformMediaId: string;
  /** Platform-native type string (IMAGE, VIDEO, CAROUSEL_ALBUM, REELS, STORY, ...). */
  mediaType?: string | null;
  publishedAt?: Date | null;
}

/** Normalised counters. `null` means the platform did not supply the metric. */
export interface PostInsights {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  followerCount: number | null;
  unavailableMetrics: MetricUnavailable[];
  raw: Record<string, unknown>;
}

export interface InsightsFetchContext {
  accessToken: string;
  /** Platform account id captured at connect time, when the API needs it. */
  platformUserId?: string | null;
  mediaType?: string | null;
  /** Capture window label — YouTube switches data source based on it. */
  windowLabel?: string;
}

export interface PostInsightsProvider {
  readonly platform: SocialPlatform;

  /**
   * Locate the submitted URL in the connected account's own media.
   *
   * Returns null when the post is not in the account — the caller records
   * `unowned`, which is a strong fraud signal, not a transient error.
   * Throws InsightsAuthError when the token or scopes are the problem.
   */
  resolveMedia(url: string, ctx: InsightsFetchContext): Promise<ResolvedPostMedia | null>;

  fetchInsights(platformMediaId: string, ctx: InsightsFetchContext): Promise<PostInsights>;
}

/**
 * The token is present but cannot do the job — expired, revoked, or missing
 * the insights scope. Distinct from a generic failure because the fix is for
 * the creator to reconnect, and the report must say so.
 */
export class InsightsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsightsAuthError';
  }
}

/** The platform genuinely cannot report on this URL / media type. */
export class InsightsUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsightsUnsupportedError';
  }
}

/** Build a fully-null insights object, then fill in what the platform gave. */
export function emptyInsights(raw: Record<string, unknown> = {}): PostInsights {
  return {
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    followerCount: null,
    unavailableMetrics: [],
    raw,
  };
}

/** Mark every metric the platform structurally cannot provide. */
export function markUnsupported(
  insights: PostInsights,
  metrics: MetricKey[],
  detail?: string,
): PostInsights {
  for (const metric of metrics) {
    insights.unavailableMetrics.push({ metric, reason: 'not_supported', detail });
  }
  return insights;
}

/** Coerce a platform counter that may arrive as a string, or be absent. */
export function toCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
