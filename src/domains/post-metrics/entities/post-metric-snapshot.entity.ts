import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { SocialPlatform } from '../../socials/constants/social-platforms';
import { MetricUnavailable } from '../post-metrics.constants';
import { SubmissionPostMedia } from './submission-post-media.entity';

/**
 * An append-only capture of one post's counters at one moment. Platform APIs
 * return cumulative point-in-time numbers with no history, so week-over-week
 * growth can only be derived by diffing snapshots.
 *
 * BIGINT columns come back from pg as strings; the repository normalises them
 * to numbers on read so callers never have to care.
 */
@Table({ tableName: 'post_metric_snapshots', updatedAt: true })
export class PostMetricSnapshot extends BaseEntity<PostMetricSnapshot> {
  @ForeignKey(() => SubmissionPostMedia)
  @Column({ type: DataType.UUID, allowNull: false, field: 'media_id' })
  declare mediaId: string;

  @BelongsTo(() => SubmissionPostMedia)
  declare media?: SubmissionPostMedia;

  @Column({ type: DataType.STRING, allowNull: false })
  declare platform: SocialPlatform;

  @Column({ type: DataType.STRING, allowNull: false, field: 'window_label' })
  declare windowLabel: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'captured_at' })
  declare capturedAt: Date;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare views?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare likes?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare comments?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare shares?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare saves?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true })
  declare reach?: number | null;

  @Column({ type: DataType.BIGINT, allowNull: true, field: 'follower_count' })
  declare followerCount?: number | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'unavailable_metrics',
  })
  declare unavailableMetrics: MetricUnavailable[];

  @Column({ type: DataType.JSONB, allowNull: true })
  declare raw?: Record<string, unknown> | null;
}
