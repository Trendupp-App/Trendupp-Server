import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialPlatform, SOCIAL_PLATFORMS } from '../../socials/constants/social-platforms';
import { METRIC_KEYS } from '../post-metrics.constants';

export class MetricValueDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'The counter, or null when the platform did not supply it.',
    example: 18420,
  })
  value!: number | null;

  @ApiProperty({
    description:
      'False when this metric could not be collected. Always check this before rendering ' +
      'the value — a missing metric is never reported as 0.',
    example: true,
  })
  available!: boolean;

  @ApiPropertyOptional({
    description: 'Why the metric is unavailable, or what the approximation means.',
    example: 'TikTok exposes no unique reach metric',
  })
  reason?: string;

  @ApiPropertyOptional({
    description:
      'True when the platform metric is a proxy rather than a like-for-like figure ' +
      '(e.g. YouTube playlist adds standing in for saves).',
    example: false,
  })
  approximate?: boolean;
}

export class PlatformMetricsDto {
  @ApiProperty({ enum: SOCIAL_PLATFORMS, example: 'instagram' })
  platform!: SocialPlatform;

  @ApiProperty({ example: 'Instagram' })
  platformLabel!: string;

  @ApiProperty({ example: 'https://www.instagram.com/reel/Cx1y2z3AbCd/' })
  url!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Platform-native media type. Drives which metrics are valid.',
    example: 'REELS',
  })
  mediaType!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  publishedAt!: Date | null;

  @ApiProperty({
    description:
      "True only when the post was found inside the creator's own connected account. " +
      'False means the metrics are not trustworthy and no totals include this post.',
    example: true,
  })
  ownershipVerified!: boolean;

  @ApiProperty({
    description:
      'pending | resolved | unowned | unsupported | unauthorized | error. ' +
      '"unowned" means the URL was not found in the creator\'s account.',
    example: 'resolved',
  })
  resolutionStatus!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  resolutionError!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  capturedAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Which scheduled capture this reading came from.',
    example: 't7d',
  })
  windowLabel!: string | null;

  @ApiProperty({
    description: `One entry per metric: ${METRIC_KEYS.join(', ')}.`,
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/MetricValueDto' },
  })
  metrics!: Record<string, MetricValueDto>;
}

export class SubmissionMetricsDto {
  @ApiProperty({ format: 'uuid' })
  submissionId!: string;

  @ApiProperty({ type: [PlatformMetricsDto] })
  platforms!: PlatformMetricsDto[];

  @ApiProperty({
    description:
      'Metrics deliberately NOT totalled because at least one platform in this set cannot ' +
      'supply them (e.g. reach across Instagram + TikTok). Render these per-platform only.',
    example: ['reach', 'saves'],
  })
  notComparableAcrossPlatforms!: string[];

  @ApiProperty({
    description: 'Cross-platform totals, only for metrics every included platform supports.',
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { views: 91230, likes: 7412, comments: 318, shares: 902 },
  })
  totals!: Record<string, number>;
}

export class CampaignMetricsDto {
  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  @ApiProperty({ type: [PlatformMetricsDto] })
  posts!: PlatformMetricsDto[];

  @ApiProperty({ example: ['reach'] })
  notComparableAcrossPlatforms!: string[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  totals!: Record<string, number>;
}

export class MetricSnapshotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 't7d' })
  windowLabel!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  capturedAt!: Date;

  @ApiPropertyOptional({ type: Number, nullable: true })
  views!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  likes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  comments!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  shares!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  saves!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  reach!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  followerCount!: number | null;
}

export class MediaHistoryDto {
  @ApiProperty({ format: 'uuid' })
  mediaId!: string;

  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  platform!: SocialPlatform;

  @ApiProperty({ example: 'https://www.instagram.com/reel/Cx1y2z3AbCd/' })
  url!: string;

  @ApiProperty({
    description: 'Every capture, oldest first. Diff consecutive rows for growth.',
    type: [MetricSnapshotDto],
  })
  snapshots!: MetricSnapshotDto[];
}

export class PlatformCapabilityDto {
  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  platform!: SocialPlatform;

  @ApiProperty({ example: 'Instagram' })
  platformLabel!: string;

  @ApiProperty({
    description: 'Which of the seven metrics this platform can report for a single post.',
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      reach: true,
      followerCount: true,
    },
  })
  supports!: Record<string, boolean>;

  @ApiPropertyOptional({
    description: 'Set when "saves" is a proxy on this platform, explaining what it counts.',
    example: 'Videos added to a YouTube playlist',
  })
  savesApproximation?: string;

  @ApiProperty({
    description: 'OAuth scopes the creator must have granted for insights calls to work.',
    example: ['instagram_business_basic', 'instagram_business_manage_insights'],
  })
  requiredScopes!: string[];
}
