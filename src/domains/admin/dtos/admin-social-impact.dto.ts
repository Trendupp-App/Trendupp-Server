import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  Min,
  IsArray,
  IsBoolean,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationMetaDto } from './admin-creators.dto';

// ── Token Batch DTO ─────────────────────────────────────────────────────────

export class TokenBatchResponseDto {
  @ApiProperty({ example: 'uuid-token-batch-1' })
  id: string;

  @ApiProperty({ example: 'Standard Batch (100 Tokens)' })
  name: string;

  @ApiProperty({ example: 100 })
  amount: number;

  @ApiProperty({ example: 'Popular reward batch', nullable: true })
  description: string | null;
}

// ── Summary KPI Response DTO ──────────────────────────────────────────────────

export class AdminSocialImpactSummaryResponseDto {
  @ApiProperty({ example: 3 })
  activeSocialCampaigns: number;

  @ApiProperty({ example: 2526 })
  totalParticipations: number;

  @ApiProperty({ example: 249260 })
  tokensDistributed: number;

  @ApiProperty({ example: 1 })
  campaignsCompleted: number;
}

// ── Query List DTO ──────────────────────────────────────────────────────────

export class QueryAdminSocialImpactListDto {
  @ApiPropertyOptional({ example: 'jollof', description: 'Search term for campaign title' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 'active',
    enum: ['all', 'draft', 'live', 'active', 'paused', 'completed'],
    description: 'Filter by campaign status tab',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'draft', 'live', 'active', 'paused', 'completed'])
  tab?: 'all' | 'draft' | 'live' | 'active' | 'paused' | 'completed' = 'all';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

// ── Campaign Creation & Draft DTOs ───────────────────────────────────────────

export class CreateSocialImpactCampaignDto {
  @ApiProperty({ example: 'Summer Style Collection 2025' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Create Content' })
  @IsString()
  goal: string;

  @ApiPropertyOptional({
    example: 'uuid-brand-user-id',
    description: 'Selected Advertiser User ID (Optional)',
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description: 'Campaign end date (required for publishing)',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    example: { Nano: 50, Micro: 100 },
    description: 'Reward amount by creator tier',
  })
  @IsOptional()
  tierRewards?: Record<string, number>;

  @ApiProperty({ example: ['Micro', 'Nano'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  creatorTiers: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'Zara Africa is launching a campaign...' })
  @IsOptional()
  @IsString()
  campaignBrief?: string;

  @ApiPropertyOptional({ example: ['1x Instagram Reel (30-60 seconds)'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @ApiPropertyOptional({ example: ['Film in warm, golden-hour lighting'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentDirection?: string[];

  @ApiPropertyOptional({ example: ['Tag brand account'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dos?: string[];

  @ApiPropertyOptional({ example: ['No competitor brands visible'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  donts?: string[];

  @ApiPropertyOptional({ example: 1, description: 'Current step in creation wizard (1, 2, or 3)' })
  @IsOptional()
  @IsNumber()
  currentStep?: number = 1;

  @ApiPropertyOptional({ example: true, description: 'Set to false if publishing directly' })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean = true;
}

export class UpdateSocialImpactCampaignDto {
  @ApiPropertyOptional({ example: 'Summer Style Collection 2025' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Create Content' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ example: 'uuid-brand-user-id' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: '2026-08-15', description: 'Campaign end date' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: { Nano: 50, Micro: 100 } })
  @IsOptional()
  tierRewards?: Record<string, number>;

  @ApiPropertyOptional({ example: ['Micro', 'Nano'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  creatorTiers?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'Zara Africa is launching a campaign...' })
  @IsOptional()
  @IsString()
  campaignBrief?: string;

  @ApiPropertyOptional({ example: ['1x Instagram Reel (30-60 seconds)'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @ApiPropertyOptional({ example: ['Film in warm, golden-hour lighting'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentDirection?: string[];

  @ApiPropertyOptional({ example: ['Tag brand account'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dos?: string[];

  @ApiPropertyOptional({ example: ['No competitor brands visible'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  donts?: string[];

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  currentStep?: number;
}

// ── Table List Item & Response DTOs ──────────────────────────────────────────

export class SocialImpactBrandDto {
  @ApiProperty({ example: 'uuid-brand-1' })
  id: string;

  @ApiProperty({ example: 'Zara Africa' })
  name: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  logoUrl: string | null;
}

export class SocialImpactCampaignListItemDto {
  @ApiProperty({ example: 'uuid-campaign-1' })
  id: string;

  @ApiProperty({ example: 'TRD-1001' })
  displayId: string;

  @ApiProperty({ example: 'Clean Nigeria Initiative' })
  title: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  coverImageUrl: string | null;

  @ApiProperty({ type: SocialImpactBrandDto })
  brand: SocialImpactBrandDto;

  @ApiProperty({ example: 'Food & Lifestyle' })
  category: string;

  @ApiProperty({ example: 100 })
  tokenReward: number;

  @ApiProperty({ example: 47 })
  appliedCount: number;

  @ApiProperty({ example: 4, description: 'Days left until completion' })
  daysLeft: number;

  @ApiProperty({ example: 'LIVE' })
  status: string;

  @ApiProperty({ example: '3/5 sections' })
  sectionsCompleted: string;

  @ApiProperty({ example: '2026-07-20T10:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ example: '2026-07-20T10:00:00Z' })
  createdAt: Date;
}

export class SocialImpactCampaignsListResponseDto {
  @ApiProperty({ type: [SocialImpactCampaignListItemDto] })
  data: SocialImpactCampaignListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

// ── Campaign Detail Response DTO ─────────────────────────────────────────────

export class SocialImpactCampaignDetailDto {
  @ApiProperty({ example: 'uuid-campaign-1' })
  id: string;

  @ApiProperty({ example: 'TRD-1001' })
  displayId: string;

  @ApiProperty({ example: 'Summer Style Collection 2025' })
  title: string;

  @ApiProperty({ example: 'LIVE' })
  status: string;

  @ApiProperty({ example: 100 })
  tokenReward: number;

  @ApiProperty({ type: SocialImpactBrandDto })
  brand: SocialImpactBrandDto;

  @ApiProperty({ example: 'https://...', nullable: true })
  coverImageUrl: string | null;

  @ApiProperty({
    example: {
      goal: 'Create Content',
      niche: 'Fashion',
      creatorTiers: ['Micro', 'Nano'],
      preferredPlatforms: ['Instagram'],
      createdAt: '2026-06-01T00:00:00Z',
    },
  })
  info: Record<string, unknown>;

  @ApiProperty({ example: 'Zara Africa is launching...' })
  campaignBrief: string;

  @ApiProperty({ example: ['1x Instagram Reel (30-60 seconds)'], type: [String] })
  deliverables: string[];

  @ApiProperty({ example: ['Film in warm, golden-hour lighting'], type: [String] })
  contentDirection: string[];

  @ApiProperty({
    example: {
      dos: ['Tag brand account'],
      donts: ['No competitor brands visible'],
    },
  })
  guidelines: { dos: string[]; donts: string[] };

  @ApiProperty({ example: 'We are looking for content that feels authentic...' })
  successLooksLike: string;

  @ApiProperty({ example: 'By participating in this campaign...' })
  usageRights: string;
}

// ── Creator Participants DTOs ────────────────────────────────────────────────

export class QuerySocialImpactParticipantsDto {
  @ApiPropertyOptional({
    example: 'all',
    enum: ['all', 'no_submission', 'pending_review', 'approved', 'rejected'],
    description: 'Filter participants by submission review status',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'no_submission', 'pending_review', 'approved', 'rejected'])
  status?: 'all' | 'no_submission' | 'pending_review' | 'approved' | 'rejected' = 'all';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class SocialImpactCreatorProfileDto {
  @ApiProperty({ example: 'uuid-creator-1' })
  id: string;

  @ApiProperty({ example: 'Adaeze Obi' })
  name: string;

  @ApiProperty({ example: '@adaeze_eats' })
  username: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 4.9 })
  rating: number;

  @ApiProperty({ example: 'Micro' })
  tier: string;

  @ApiProperty({ example: '180K' })
  followers: string;

  @ApiProperty({ example: '5.2%' })
  engagementRate: string;
}

export class SocialImpactParticipantItemDto {
  @ApiProperty({ example: 'uuid-application-1' })
  applicationId: string;

  @ApiProperty({ type: SocialImpactCreatorProfileDto })
  creator: SocialImpactCreatorProfileDto;

  @ApiProperty({ example: 100 })
  tokenReward: number;

  @ApiProperty({ example: 'https://instagram.com/p/example1', nullable: true })
  contentLink: string | null;

  @ApiProperty({ example: 'pending_review' })
  status: string;

  @ApiProperty({ example: '2026-07-20T10:00:00Z', nullable: true })
  submittedAt: Date | null;
}

export class SocialImpactParticipantsListResponseDto {
  @ApiProperty({ type: [SocialImpactParticipantItemDto] })
  data: SocialImpactParticipantItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class ReviewParticipantSubmissionDto {
  @ApiPropertyOptional({ example: 'Hashtag missing from caption' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ── Admin Action DTOs ────────────────────────────────────────────────────────

export class ExtendDeadlineDto {
  @ApiProperty({
    example: '2026-08-01',
    description: 'New submission deadline date (ISO string or YYYY-MM-DD)',
  })
  @IsString()
  newDeadline: string;

  @ApiPropertyOptional({
    example: 'Extended duration for creator submissions',
    description: 'Optional reason for deadline extension',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelCampaignDto {
  @ApiPropertyOptional({
    example: 'Cancelled by admin request',
    description: 'Optional cancellation reason',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CloseApplicationsDto {
  @ApiPropertyOptional({
    example: 'Application window reached capacity',
    description: 'Optional reason for closing applications',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PauseCampaignDto {
  @ApiPropertyOptional({
    example: 'Temporary pause for administrative review',
    description: 'Optional pause reason',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ToggleSocialImpactStatusDto {
  @ApiProperty({
    example: 'pause',
    enum: ['pause', 'resume'],
    description:
      'Action to perform: "pause" to pause an active campaign, "resume" to reactivate a paused campaign',
  })
  @IsEnum(['pause', 'resume'])
  action: 'pause' | 'resume';

  @ApiPropertyOptional({
    example: 'Temporary administrative review',
    description: 'Optional reason for pausing or resuming',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
