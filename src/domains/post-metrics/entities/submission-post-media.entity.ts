import { Table, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { ContentSubmission } from '../../campaigns/entities/content-submission.entity';
import { User } from '../../users/entities/user.entity';
import { SocialPlatform } from '../../socials/constants/social-platforms';
// `import type` is required by isolatedModules + emitDecoratorMetadata: a
// pure type used in a decorated signature must not emit a runtime import.
import type { ResolutionStatus } from '../post-metrics.constants';
import { PostMetricSnapshot } from './post-metric-snapshot.entity';

/**
 * One submitted live post on one platform, resolved to a platform-native
 * media id we can pull insights for. See the migration for why ownership
 * verification is central rather than incidental.
 */
@Table({ tableName: 'submission_post_media' })
export class SubmissionPostMedia extends BaseEntity<SubmissionPostMedia> {
  @ForeignKey(() => ContentSubmission)
  @Column({ type: DataType.UUID, allowNull: false, field: 'submission_id' })
  declare submissionId: string;

  @BelongsTo(() => ContentSubmission)
  declare submission?: ContentSubmission;

  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign?: Campaign;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'creator_id' })
  declare creatorId: string;

  @BelongsTo(() => User)
  declare creator?: User;

  @Column({ type: DataType.STRING, allowNull: false })
  declare platform: SocialPlatform;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare url: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'platform_media_id' })
  declare platformMediaId?: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'media_type' })
  declare mediaType?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'published_at' })
  declare publishedAt?: Date | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'ownership_verified',
  })
  declare ownershipVerified: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending',
    field: 'resolution_status',
  })
  declare resolutionStatus: ResolutionStatus;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'resolution_error' })
  declare resolutionError?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'resolved_at' })
  declare resolvedAt?: Date | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'captured_windows',
  })
  declare capturedWindows: string[];

  @Column({ type: DataType.DATE, allowNull: true, field: 'last_captured_at' })
  declare lastCapturedAt?: Date | null;

  @HasMany(() => PostMetricSnapshot, 'mediaId')
  declare snapshots?: PostMetricSnapshot[];
}
