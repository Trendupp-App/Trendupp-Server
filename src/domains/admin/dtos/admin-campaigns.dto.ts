import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationMetaDto } from './admin-creators.dto';

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class QueryAdminCampaignsListDto {
  @ApiPropertyOptional({
    example: 'summer',
    description: 'Search term for campaign title, ID (TRD-1001), or brand name',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 'all',
    enum: ['all', 'draft', 'live', 'active', 'paused', 'completed', 'cancelled'],
    description: 'Filter by campaign status tab',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'draft', 'live', 'active', 'paused', 'completed', 'cancelled'])
  tab?: 'all' | 'draft' | 'live' | 'active' | 'paused' | 'completed' | 'cancelled' = 'all';

  @ApiPropertyOptional({
    example: 'funded',
    description: 'Filter by escrow payment status (funded, released, not_funded, refunded)',
  })
  @IsOptional()
  @IsString()
  escrowStatus?: string;

  @ApiPropertyOptional({
    example: 'micro',
    description: 'Filter by creator tier (nano, micro, macro, mega)',
  })
  @IsOptional()
  @IsString()
  creatorTier?: string;

  @ApiPropertyOptional({
    example: 'instagram',
    description: 'Filter by posting platform (instagram, tiktok, youtube, twitter)',
  })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

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

// ── Summary KPI Response DTO ──────────────────────────────────────────────────

export class AdminCampaignSummaryResponseDto {
  @ApiProperty({ example: 7 })
  totalCampaigns: number;

  @ApiProperty({ example: 1 })
  draft: number;

  @ApiProperty({ example: 1 })
  live: number;

  @ApiProperty({ example: 1 })
  active: number;

  @ApiProperty({ example: 1 })
  completed: number;

  @ApiProperty({ example: 0 })
  cancelled: number;
}

// ── Table Item Response DTOs ─────────────────────────────────────────────────

export class AdminCampaignBrandDto {
  @ApiProperty({ example: 'uuid-brand-1' })
  id: string;

  @ApiProperty({ example: 'Zara Africa' })
  name: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  logoUrl: string | null;
}

export class AdminCampaignListItemDto {
  @ApiProperty({ example: 'uuid-campaign-1' })
  id: string;

  @ApiProperty({ example: 'TRD-1001' })
  displayId: string;

  @ApiProperty({ example: 'Summer Style Collective' })
  title: string;

  @ApiProperty({ type: AdminCampaignBrandDto })
  brand: AdminCampaignBrandDto;

  @ApiProperty({ example: 3000000 })
  budget: number;

  @ApiProperty({ example: 'Micro' })
  creatorTier: string;

  @ApiProperty({ example: 'Instagram' })
  postingPlatform: string;

  @ApiProperty({ example: 47 })
  applicationsCount: number;

  @ApiProperty({ example: 'LIVE' })
  status: string;

  @ApiProperty({ example: 'FUNDED' })
  escrowStatus: string;

  @ApiProperty({ example: '2026-06-01T00:00:00Z', nullable: true })
  endDate: Date | null;

  @ApiProperty({ example: '2026-06-01T00:00:00Z' })
  createdAt: Date;
}

export class AdminCampaignsListResponseDto {
  @ApiProperty({ type: [AdminCampaignListItemDto] })
  data: AdminCampaignListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
