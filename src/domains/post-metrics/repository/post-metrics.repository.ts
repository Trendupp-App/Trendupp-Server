import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal } from 'sequelize';
import { SubmissionPostMedia } from '../entities/submission-post-media.entity';
import { PostMetricSnapshot } from '../entities/post-metric-snapshot.entity';
import { ContentSubmission } from '../../campaigns/entities/content-submission.entity';
import { SocialPlatform } from '../../socials/constants/social-platforms';
import { MetricUnavailable, ResolutionStatus } from '../post-metrics.constants';

export interface PostMediaSeed {
  submissionId: string;
  campaignId: string;
  creatorId: string;
  platform: SocialPlatform;
  url: string;
}

export type PostMediaUpdate = Partial<{
  platformMediaId: string | null;
  mediaType: string | null;
  publishedAt: Date | null;
  ownershipVerified: boolean;
  resolutionStatus: ResolutionStatus;
  resolutionError: string | null;
  resolvedAt: Date | null;
  capturedWindows: string[];
  lastCapturedAt: Date | null;
}>;

export interface SnapshotSeed {
  mediaId: string;
  platform: SocialPlatform;
  windowLabel: string;
  capturedAt: Date;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reach?: number | null;
  followerCount?: number | null;
  unavailableMetrics: MetricUnavailable[];
  raw?: Record<string, unknown> | null;
}

@Injectable()
export class PostMetricsRepository {
  constructor(
    @InjectModel(SubmissionPostMedia)
    private readonly mediaModel: typeof SubmissionPostMedia,
    @InjectModel(PostMetricSnapshot)
    private readonly snapshotModel: typeof PostMetricSnapshot,
    @InjectModel(ContentSubmission)
    private readonly submissionModel: typeof ContentSubmission,
  ) {}

  /**
   * Submissions carrying a live link that has no media row yet.
   *
   * The collector pulls these itself rather than campaigns.service pushing to
   * us — that keeps the two modules independent (no circular import) and, as
   * a bonus, backfills every live link submitted before this feature existed.
   */
  findSubmissionsNeedingRegistration(limit = 25): Promise<ContentSubmission[]> {
    return this.submissionModel.findAll({
      where: {
        [Op.and]: [
          literal('live_link IS NOT NULL'),
          literal(
            'NOT EXISTS (SELECT 1 FROM submission_post_media m ' +
              'WHERE m.submission_id = "ContentSubmission"."id" AND m.deleted_at IS NULL)',
          ),
        ],
      },
      order: [['updatedAt', 'DESC']],
      limit,
    });
  }

  findMediaById(id: string): Promise<SubmissionPostMedia | null> {
    return this.mediaModel.findByPk(id);
  }

  findMediaBySubmission(submissionId: string): Promise<SubmissionPostMedia[]> {
    return this.mediaModel.findAll({
      where: { submissionId },
      order: [['platform', 'ASC']],
    });
  }

  findMediaByCampaign(campaignId: string): Promise<SubmissionPostMedia[]> {
    return this.mediaModel.findAll({
      where: { campaignId },
      order: [
        ['creatorId', 'ASC'],
        ['platform', 'ASC'],
      ],
    });
  }

  /**
   * Re-submitting a live link for the same platform replaces the previous
   * resolution rather than creating a second row — the unique index on
   * (submission_id, platform) enforces it, and stale snapshots stay attached
   * to the row so history is not silently lost.
   */
  async upsertMedia(seed: PostMediaSeed): Promise<SubmissionPostMedia> {
    const existing = await this.mediaModel.findOne({
      where: { submissionId: seed.submissionId, platform: seed.platform },
    });

    if (existing) {
      if (existing.url !== seed.url) {
        // A different URL means a different post: reset resolution + schedule.
        await existing.update({
          url: seed.url,
          platformMediaId: null,
          mediaType: null,
          publishedAt: null,
          ownershipVerified: false,
          resolutionStatus: 'pending',
          resolutionError: null,
          resolvedAt: null,
          capturedWindows: [],
          lastCapturedAt: null,
        });
      }
      return existing;
    }

    // Cast at the creation boundary — Sequelize's creation-attributes generic
    // cannot be satisfied through this partial shape (same pattern as BaseService).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.mediaModel as any).create({ ...seed }) as Promise<SubmissionPostMedia>;
  }

  async updateMedia(id: string, data: PostMediaUpdate): Promise<SubmissionPostMedia | null> {
    const media = await this.mediaModel.findByPk(id);
    if (!media) return null;
    await media.update(data);
    return media;
  }

  /** Media still awaiting a first successful resolution. */
  findPendingResolution(limit = 50): Promise<SubmissionPostMedia[]> {
    return this.mediaModel.findAll({
      where: { resolutionStatus: 'pending' },
      order: [['createdAt', 'ASC']],
      limit,
    });
  }

  /**
   * Resolved media whose published_at is old enough that at least one capture
   * window is due. Window selection itself lives in the service — this only
   * narrows the candidate set cheaply.
   */
  findCaptureCandidates(oldestPublishedAfter: Date, limit = 100): Promise<SubmissionPostMedia[]> {
    return this.mediaModel.findAll({
      where: {
        resolutionStatus: 'resolved',
        ownershipVerified: true,
        // A non-null lower bound already excludes NULL published_at.
        publishedAt: { [Op.gte]: oldestPublishedAfter },
      },
      // Never-captured media must go first; plain ASC would sort NULLs last
      // in Postgres, so express it as a literal.
      order: [literal('last_captured_at ASC NULLS FIRST')],
      limit,
    });
  }

  async createSnapshot(seed: SnapshotSeed): Promise<PostMetricSnapshot> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const created = (await (this.snapshotModel as any).create({
      ...seed,
    })) as PostMetricSnapshot;
    return this.normalizeSnapshot(created);
  }

  async findSnapshots(mediaId: string): Promise<PostMetricSnapshot[]> {
    const rows = await this.snapshotModel.findAll({
      where: { mediaId },
      order: [['capturedAt', 'ASC']],
    });
    return rows.map((r) => this.normalizeSnapshot(r));
  }

  async findLatestSnapshot(mediaId: string): Promise<PostMetricSnapshot | null> {
    const row = await this.snapshotModel.findOne({
      where: { mediaId },
      order: [['capturedAt', 'DESC']],
    });
    return row ? this.normalizeSnapshot(row) : null;
  }

  async findLatestSnapshotsForMedia(mediaIds: string[]): Promise<Map<string, PostMetricSnapshot>> {
    if (mediaIds.length === 0) return new Map();

    const rows = await this.snapshotModel.findAll({
      where: { mediaId: { [Op.in]: mediaIds } },
      order: [['capturedAt', 'ASC']],
    });

    // Ascending order means the last write per media wins — the latest capture.
    const latest = new Map<string, PostMetricSnapshot>();
    for (const row of rows) latest.set(row.mediaId, this.normalizeSnapshot(row));
    return latest;
  }

  /**
   * pg returns BIGINT as a string to avoid precision loss. Every metric here
   * is well inside Number.MAX_SAFE_INTEGER, so coerce once on read rather
   * than leaking `string | number` into every consumer.
   */
  private normalizeSnapshot(row: PostMetricSnapshot): PostMetricSnapshot {
    const keys = [
      'views',
      'likes',
      'comments',
      'shares',
      'saves',
      'reach',
      'followerCount',
    ] as const;

    for (const key of keys) {
      const value = row[key] as unknown;
      row[key] = value === null || value === undefined ? null : Number(value);
    }
    return row;
  }
}
