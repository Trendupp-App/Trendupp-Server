import { SocialPlatform } from '../socials/constants/social-platforms';

export const POST_METRICS_QUEUE = 'post-metrics';

/** The seven metrics an advertiser report can carry. */
export const METRIC_KEYS = [
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'reach',
  'followerCount',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * Why a metric is missing. Distinguishing these matters: `not_supported` is
 * permanent and should be worded as such to advertisers, while
 * `needs_reconnect` is fixable by the creator re-granting scopes.
 */
export type MetricUnavailableReason =
  | 'not_supported'
  | 'not_supported_for_media_type'
  | 'needs_reconnect'
  | 'fetch_failed';

export interface MetricUnavailable {
  metric: MetricKey;
  reason: MetricUnavailableReason;
  detail?: string;
}

/**
 * Which metrics each platform can actually deliver for a SINGLE post.
 *
 * `false` here is not a gap in our implementation — the platform has no such
 * metric at any level:
 *  - reach (unique accounts) exists only on Instagram and Facebook. TikTok,
 *    YouTube and X expose no unique-reach metric whatsoever.
 *  - saves is a true metric only on Instagram (`saved`). TikTok's
 *    `collect_count`, YouTube's `videosAddedToPlaylists` and X's
 *    `bookmark_count` are approximations that mean different things, so they
 *    are surfaced but flagged (see SAVES_IS_APPROXIMATE).
 *
 * followerCount is always account-level; it is captured alongside post
 * metrics so a report can state the audience size at publish time.
 */
export const PLATFORM_METRIC_SUPPORT: Record<SocialPlatform, Record<MetricKey, boolean>> = {
  [SocialPlatform.INSTAGRAM]: {
    views: true,
    likes: true,
    comments: true,
    shares: true,
    saves: true,
    reach: true,
    followerCount: true,
  },
  [SocialPlatform.TIKTOK]: {
    views: true,
    likes: true,
    comments: true,
    shares: true,
    saves: true, // collect_count — approximate
    reach: false,
    followerCount: true,
  },
  [SocialPlatform.YOUTUBE]: {
    views: true,
    likes: true,
    comments: true,
    shares: true,
    saves: true, // videosAddedToPlaylists — approximate
    reach: false,
    followerCount: true,
  },
  [SocialPlatform.FACEBOOK]: {
    views: true,
    likes: true,
    comments: true,
    shares: true,
    saves: false,
    reach: true, // post_impressions_unique
    followerCount: true,
  },
  [SocialPlatform.TWITTER]: {
    views: true, // impression_count
    likes: true,
    comments: true, // reply_count
    shares: true, // retweet_count + quote_count
    saves: true, // bookmark_count — approximate
    reach: false,
    followerCount: true,
  },
};

/**
 * Platforms where "saves" is a proxy rather than a real save/bookmark of the
 * post. Reports must label these so advertisers do not compare them directly
 * with Instagram saves.
 */
export const SAVES_IS_APPROXIMATE: Partial<Record<SocialPlatform, string>> = {
  [SocialPlatform.TIKTOK]: 'TikTok "collects" (added to favourites)',
  [SocialPlatform.YOUTUBE]: 'Videos added to a YouTube playlist',
  [SocialPlatform.TWITTER]: 'Bookmarks',
};

/**
 * Instagram media types that cannot report views. Videos inside a carousel
 * album always return 0, which would understate the post — treat it as
 * unavailable rather than reporting a false zero.
 */
export const INSTAGRAM_VIEWLESS_MEDIA_TYPES = new Set(['CAROUSEL_ALBUM']);

/** Capture windows, as an offset from the moment the post went live. */
export interface CaptureWindow {
  label: 't24h' | 't7d' | 't30d';
  offsetMs: number;
}

export const CAPTURE_WINDOWS: CaptureWindow[] = [
  { label: 't24h', offsetMs: 24 * 60 * 60 * 1000 },
  { label: 't7d', offsetMs: 7 * 24 * 60 * 60 * 1000 },
  { label: 't30d', offsetMs: 30 * 24 * 60 * 60 * 1000 },
];

/**
 * YouTube Analytics is day-bucketed and takes 2-3 days to settle, so a T+24h
 * read is materially under-reported. The provider therefore serves the early
 * window from the real-time public counters (videos.list statistics) and only
 * uses the Analytics API — the sole source of shares and playlist adds — from
 * T+7d onward.
 */
export const YOUTUBE_ANALYTICS_MIN_WINDOW: CaptureWindow['label'] = 't7d';

/**
 * Instagram Stories vanish after 24h and take their insights with them, so
 * the standard schedule would always miss them.
 */
export const STORY_CAPTURE_OFFSET_MS = 20 * 60 * 60 * 1000;

/** OAuth scopes each platform needs before insights calls will succeed. */
export const REQUIRED_INSIGHTS_SCOPES: Record<SocialPlatform, string[]> = {
  [SocialPlatform.INSTAGRAM]: ['instagram_business_basic', 'instagram_business_manage_insights'],
  [SocialPlatform.TIKTOK]: ['user.info.basic', 'user.info.stats', 'video.list'],
  [SocialPlatform.YOUTUBE]: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ],
  [SocialPlatform.FACEBOOK]: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
  [SocialPlatform.TWITTER]: ['users.read', 'tweet.read'],
};

export type ResolutionStatus =
  | 'pending'
  | 'resolved'
  | 'unowned'
  | 'unsupported'
  | 'unauthorized'
  | 'error';
