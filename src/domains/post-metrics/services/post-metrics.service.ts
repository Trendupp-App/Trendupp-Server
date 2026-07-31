import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SocialPlatform, PLATFORM_LABELS } from '../../socials/constants/social-platforms';
import { SocialConnectionRepository } from '../../socials/repository/social-connection.repository';
import { PostInsightsRegistry } from '../../../integration/social-apis/insights/post-insights.registry';
import { InsightsAuthError } from '../../../integration/social-apis/insights/post-insights.types';
import { PostMetricsRepository } from '../repository/post-metrics.repository';
import { SubmissionPostMedia } from '../entities/submission-post-media.entity';
import { PostMetricSnapshot } from '../entities/post-metric-snapshot.entity';
import {
  CAPTURE_WINDOWS,
  METRIC_KEYS,
  MetricKey,
  MetricUnavailable,
  PLATFORM_METRIC_SUPPORT,
  SAVES_IS_APPROXIMATE,
  STORY_CAPTURE_OFFSET_MS,
} from '../post-metrics.constants';

export interface MetricValue {
  value: number | null;
  available: boolean;
  reason?: string;
  /** True when the platform's metric is a proxy, not a like-for-like figure. */
  approximate?: boolean;
}

export interface PlatformMetricsView {
  platform: SocialPlatform;
  platformLabel: string;
  url: string;
  mediaType: string | null;
  publishedAt: Date | null;
  ownershipVerified: boolean;
  resolutionStatus: string;
  resolutionError: string | null;
  capturedAt: Date | null;
  windowLabel: string | null;
  metrics: Record<MetricKey, MetricValue>;
}

export interface SubmissionMetricsView {
  submissionId: string;
  platforms: PlatformMetricsView[];
  /** Metrics that cannot be totalled because some platform cannot supply them. */
  notComparableAcrossPlatforms: MetricKey[];
  totals: Partial<Record<MetricKey, number>>;
}

@Injectable()
export class PostMetricsService {
  private readonly logger = new Logger(PostMetricsService.name);

  constructor(
    private readonly repository: PostMetricsRepository,
    private readonly connections: SocialConnectionRepository,
    private readonly registry: PostInsightsRegistry,
  ) {}

  /**
   * Capture one snapshot for one media. Returns null when the media is not in
   * a state that can be captured (unresolved, unowned, no provider) — the
   * caller records nothing rather than writing a row full of zeros.
   */
  async captureSnapshot(mediaId: string, windowLabel: string): Promise<PostMetricSnapshot | null> {
    const media = await this.repository.findMediaById(mediaId);
    if (!media) return null;

    if (media.resolutionStatus !== 'resolved' || !media.platformMediaId) {
      this.logger.warn(
        `Skipping capture for media ${mediaId}: resolution status is "${media.resolutionStatus}"`,
      );
      return null;
    }

    const provider = this.registry.get(media.platform);
    if (!provider) return null;

    const connection = await this.connections.findByUserAndPlatform(
      media.creatorId,
      media.platform,
    );
    if (!connection?.accessToken) {
      await this.repository.updateMedia(media.id, {
        resolutionStatus: 'unauthorized',
        resolutionError: `${PLATFORM_LABELS[media.platform]} is no longer connected`,
      });
      return null;
    }

    try {
      const insights = await provider.fetchInsights(media.platformMediaId, {
        accessToken: connection.accessToken,
        platformUserId: connection.platformUserId,
        mediaType: media.mediaType,
        windowLabel,
      });

      const snapshot = await this.repository.createSnapshot({
        mediaId: media.id,
        platform: media.platform,
        windowLabel,
        capturedAt: new Date(),
        views: insights.views,
        likes: insights.likes,
        comments: insights.comments,
        shares: insights.shares,
        saves: insights.saves,
        reach: insights.reach,
        // Follower count is account-level; the connection row is refreshed by
        // the socials verification flow, so read it from there rather than
        // spending another platform call.
        followerCount: connection.followerCount ?? null,
        unavailableMetrics: insights.unavailableMetrics,
        raw: insights.raw,
      });

      const capturedWindows = media.capturedWindows.includes(windowLabel)
        ? media.capturedWindows
        : [...media.capturedWindows, windowLabel];

      await this.repository.updateMedia(media.id, {
        capturedWindows,
        lastCapturedAt: snapshot.capturedAt,
      });

      return snapshot;
    } catch (error) {
      if (error instanceof InsightsAuthError) {
        await this.repository.updateMedia(media.id, {
          resolutionStatus: 'unauthorized',
          resolutionError: error.message,
        });
        return null;
      }
      this.logger.error(
        `Capture failed for media ${media.id} (${media.platform}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Which capture windows are due for a media, given how long ago it went
   * live and what has already been captured.
   *
   * Instagram Stories are special-cased: they disappear after 24 hours and
   * take their insights with them, so their single capture must land before
   * that, not at T+24h.
   */
  dueWindows(media: SubmissionPostMedia, now = new Date()): string[] {
    if (!media.publishedAt) return [];
    const age = now.getTime() - new Date(media.publishedAt).getTime();

    if (this.isStory(media)) {
      const done = media.capturedWindows.includes('story');
      return !done && age >= STORY_CAPTURE_OFFSET_MS ? ['story'] : [];
    }

    return CAPTURE_WINDOWS.filter(
      (window) => age >= window.offsetMs && !media.capturedWindows.includes(window.label),
    ).map((window) => window.label);
  }

  /** Stories are the one media type whose insights expire with the post. */
  private isStory(media: SubmissionPostMedia): boolean {
    return (media.mediaType ?? '').toUpperCase() === 'STORY';
  }

  /** The advertiser-facing view for a single submission. */
  async getSubmissionMetrics(submissionId: string): Promise<SubmissionMetricsView> {
    const media = await this.repository.findMediaBySubmission(submissionId);
    if (media.length === 0) {
      throw new NotFoundException('No live posts have been registered for this submission yet');
    }

    const latest = await this.repository.findLatestSnapshotsForMedia(media.map((m) => m.id));
    const platforms = media.map((m) => this.buildPlatformView(m, latest.get(m.id) ?? null));

    return {
      submissionId,
      platforms,
      ...this.summarise(platforms),
    };
  }

  /** Campaign-wide roll-up: every creator's post, grouped by platform. */
  async getCampaignMetrics(campaignId: string): Promise<{
    campaignId: string;
    posts: PlatformMetricsView[];
    notComparableAcrossPlatforms: MetricKey[];
    totals: Partial<Record<MetricKey, number>>;
  }> {
    const media = await this.repository.findMediaByCampaign(campaignId);
    const latest = await this.repository.findLatestSnapshotsForMedia(media.map((m) => m.id));
    const posts = media.map((m) => this.buildPlatformView(m, latest.get(m.id) ?? null));

    return { campaignId, posts, ...this.summarise(posts) };
  }

  /** Full snapshot history for one media — powers growth charts. */
  async getMediaHistory(mediaId: string): Promise<{
    media: SubmissionPostMedia;
    snapshots: PostMetricSnapshot[];
  }> {
    const media = await this.repository.findMediaById(mediaId);
    if (!media) throw new NotFoundException('Post media not found');
    return { media, snapshots: await this.repository.findSnapshots(mediaId) };
  }

  private buildPlatformView(
    media: SubmissionPostMedia,
    snapshot: PostMetricSnapshot | null,
  ): PlatformMetricsView {
    const support = PLATFORM_METRIC_SUPPORT[media.platform];
    const unavailable = new Map<MetricKey, MetricUnavailable>(
      (snapshot?.unavailableMetrics ?? []).map((u) => [u.metric, u]),
    );

    const metrics = {} as Record<MetricKey, MetricValue>;

    for (const key of METRIC_KEYS) {
      // A platform that structurally lacks the metric is stated as such
      // regardless of whether a snapshot exists — that fact never changes.
      if (!support[key]) {
        metrics[key] = {
          value: null,
          available: false,
          reason: `${PLATFORM_LABELS[media.platform]} does not provide this metric`,
        };
        continue;
      }

      const flagged = unavailable.get(key);
      if (flagged) {
        metrics[key] = {
          value: null,
          available: false,
          reason: flagged.detail ?? flagged.reason,
        };
        continue;
      }

      if (!snapshot) {
        metrics[key] = {
          value: null,
          available: false,
          reason: 'Not captured yet',
        };
        continue;
      }

      metrics[key] = {
        value: snapshot[key] ?? null,
        available: snapshot[key] !== null && snapshot[key] !== undefined,
        approximate: key === 'saves' ? Boolean(SAVES_IS_APPROXIMATE[media.platform]) : undefined,
        reason: key === 'saves' ? (SAVES_IS_APPROXIMATE[media.platform] ?? undefined) : undefined,
      };
    }

    return {
      platform: media.platform,
      platformLabel: PLATFORM_LABELS[media.platform],
      url: media.url,
      mediaType: media.mediaType ?? null,
      publishedAt: media.publishedAt ?? null,
      ownershipVerified: media.ownershipVerified,
      resolutionStatus: media.resolutionStatus,
      resolutionError: media.resolutionError ?? null,
      capturedAt: snapshot?.capturedAt ?? null,
      windowLabel: snapshot?.windowLabel ?? null,
      metrics,
    };
  }

  /**
   * Totals are only emitted for metrics EVERY included platform can supply.
   * Summing reach across Instagram and TikTok would silently under-report by
   * however much TikTok contributed, so those metrics are listed as
   * not-comparable instead of being quietly totalled.
   */
  private summarise(views: PlatformMetricsView[]): {
    notComparableAcrossPlatforms: MetricKey[];
    totals: Partial<Record<MetricKey, number>>;
  } {
    const notComparable: MetricKey[] = [];
    const totals: Partial<Record<MetricKey, number>> = {};

    for (const key of METRIC_KEYS) {
      // followerCount is per-creator, not per-post: summing it double-counts
      // a creator who posted on several platforms.
      if (key === 'followerCount') continue;

      const relevant = views.filter((v) => v.ownershipVerified);
      if (relevant.length === 0) continue;

      const everyPlatformSupports = relevant.every((v) => v.metrics[key].available);
      const mixedApproximation =
        new Set(relevant.map((v) => Boolean(v.metrics[key].approximate))).size > 1;

      if (!everyPlatformSupports || mixedApproximation) {
        notComparable.push(key);
        continue;
      }

      totals[key] = relevant.reduce((sum, v) => sum + (v.metrics[key].value ?? 0), 0);
    }

    return { notComparableAcrossPlatforms: notComparable, totals };
  }
}
