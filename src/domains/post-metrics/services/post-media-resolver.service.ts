import { Injectable, Logger } from '@nestjs/common';
// isSocialPlatform is a type guard, so it narrows the string to SocialPlatform
// on its own — no cast needed at the call site.
import { isSocialPlatform } from '../../socials/constants/social-platforms';
import { SocialConnectionRepository } from '../../socials/repository/social-connection.repository';
import { PostInsightsRegistry } from '../../../integration/social-apis/insights/post-insights.registry';
import {
  InsightsAuthError,
  InsightsUnsupportedError,
} from '../../../integration/social-apis/insights/post-insights.types';
import { PostMetricsRepository } from '../repository/post-metrics.repository';
import { SubmissionPostMedia } from '../entities/submission-post-media.entity';
import { ResolutionStatus } from '../post-metrics.constants';

export interface RegisterSubmissionInput {
  submissionId: string;
  campaignId: string;
  creatorId: string;
  /** The submission's liveLink map: platform -> URL. */
  liveLink: Record<string, string>;
}

/**
 * Turns submitted live-post URLs into platform media ids that we can pull
 * insights for, and records whether the creator actually owns them.
 *
 * Ownership is not a nice-to-have: every platform insights API refuses media
 * it does not own, so a resolution failure of type `unowned` means the URL is
 * not in the connected account at all.
 */
@Injectable()
export class PostMediaResolverService {
  private readonly logger = new Logger(PostMediaResolverService.name);

  constructor(
    private readonly repository: PostMetricsRepository,
    private readonly connections: SocialConnectionRepository,
    private readonly registry: PostInsightsRegistry,
  ) {}

  /**
   * Create/refresh one media row per platform in the submission's liveLink.
   * Called when a creator submits a live post; resolution itself happens in
   * the background so a slow platform API can never block the submission.
   */
  async registerSubmission(input: RegisterSubmissionInput): Promise<SubmissionPostMedia[]> {
    const rows: SubmissionPostMedia[] = [];

    for (const [rawPlatform, url] of Object.entries(input.liveLink)) {
      const platform = rawPlatform.toLowerCase();
      if (!isSocialPlatform(platform)) {
        this.logger.warn(
          `Submission ${input.submissionId} carries live link for unknown platform "${rawPlatform}" — skipped`,
        );
        continue;
      }
      if (typeof url !== 'string' || url.length === 0) continue;

      rows.push(
        await this.repository.upsertMedia({
          submissionId: input.submissionId,
          campaignId: input.campaignId,
          creatorId: input.creatorId,
          platform: platform,
          url,
        }),
      );
    }

    return rows;
  }

  /**
   * Resolve one media row against the creator's connected account.
   * Never throws: every outcome is persisted as a resolution_status so the
   * scheduler and the report can both reason about it.
   */
  async resolve(mediaId: string): Promise<SubmissionPostMedia | null> {
    const media = await this.repository.findMediaById(mediaId);
    if (!media) return null;

    const provider = this.registry.get(media.platform);
    if (!provider) {
      return this.fail(media, 'unsupported', `No insights provider for ${media.platform}`);
    }

    const connection = await this.connections.findByUserAndPlatform(
      media.creatorId,
      media.platform,
    );
    if (!connection?.accessToken) {
      return this.fail(
        media,
        'unauthorized',
        `Creator has no connected ${media.platform} account — metrics cannot be collected`,
      );
    }

    try {
      const resolved = await provider.resolveMedia(media.url, {
        accessToken: connection.accessToken,
        platformUserId: connection.platformUserId,
      });

      if (!resolved) {
        // Either the URL shape is not resolvable (short links, /share/ codes)
        // or the post is genuinely not in this account. Both need a human, so
        // record the URL in the message to make triage possible.
        return this.fail(
          media,
          'unowned',
          `Could not find this post in the creator's ${media.platform} account`,
        );
      }

      return await this.repository.updateMedia(media.id, {
        platformMediaId: resolved.platformMediaId,
        mediaType: resolved.mediaType ?? null,
        publishedAt: resolved.publishedAt ?? new Date(),
        ownershipVerified: true,
        resolutionStatus: 'resolved',
        resolutionError: null,
        resolvedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof InsightsAuthError) {
        return this.fail(media, 'unauthorized', error.message);
      }
      if (error instanceof InsightsUnsupportedError) {
        return this.fail(media, 'unsupported', error.message);
      }
      // Transient platform failure — stays `pending` so the next tick retries.
      this.logger.error(
        `Resolution of media ${media.id} (${media.platform}) failed: ${(error as Error).message}`,
      );
      await this.repository.updateMedia(media.id, {
        resolutionError: (error as Error).message,
      });
      return this.repository.findMediaById(media.id);
    }
  }

  private async fail(
    media: SubmissionPostMedia,
    status: ResolutionStatus,
    message: string,
  ): Promise<SubmissionPostMedia | null> {
    this.logger.warn(`Media ${media.id} (${media.platform}) -> ${status}: ${message}`);
    return this.repository.updateMedia(media.id, {
      resolutionStatus: status,
      resolutionError: message,
      ownershipVerified: false,
    });
  }
}
