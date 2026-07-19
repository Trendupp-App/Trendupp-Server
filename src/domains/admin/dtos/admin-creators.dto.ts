import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class QueryWidgetTimeFilterDto {
  @ApiPropertyOptional({
    example: 'monthly',
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Grouping period: daily, weekly, or monthly',
  })
  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: 'daily' | 'weekly' | 'monthly' = 'monthly';

  @ApiPropertyOptional({ example: 2026, description: 'Filter by year (e.g. 2026)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ example: 7, description: 'Filter by month (1 - 12)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class QueryTopCreatorsWidgetDto {
  @ApiPropertyOptional({ example: '2026-06-01', description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 5, default: 5, description: 'Number of top creators to fetch' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 5;
}

export class QueryAdminCreatorAnalyticsDto extends QueryWidgetTimeFilterDto {}

export class QueryAdminCreatorsListDto {
  @ApiPropertyOptional({ example: 'amara', description: 'Search term for name, username or email' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 'all',
    enum: ['all', 'onboarded', 'suspended', 'pending'],
    description: 'Tab filter: all, onboarded (100% profile), suspended, or pending',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'onboarded', 'suspended', 'pending'])
  tab?: 'all' | 'onboarded' | 'suspended' | 'pending' = 'all';

  @ApiPropertyOptional({
    example: 'macro',
    description: 'Filter by creator tier (nano, micro, macro, mega)',
  })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ example: 'niche-uuid-1', description: 'Filter by niche ID' })
  @IsOptional()
  @IsString()
  nicheId?: string;

  @ApiPropertyOptional({ example: 'female', description: 'Filter by gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    example: 'active',
    description: 'Filter by account status (active, suspended, pending)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'country-uuid-1', description: 'Filter by country ID' })
  @IsOptional()
  @IsString()
  countryId?: string;

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

// ── Widget Component Response DTOs ────────────────────────────────────────────

export class CreatorSummaryDto {
  @ApiProperty({ example: 3847 })
  totalCreators: number;

  @ApiProperty({ example: 3124 })
  profileCompleted: number;

  @ApiProperty({ example: 187 })
  suspendedCreators: number;

  @ApiProperty({ example: 536 })
  pendingProfileCompletion: number;
}

export class TimeSeriesPointDto {
  @ApiProperty({ example: 'Jun' })
  label: string;

  @ApiProperty({ example: 2000 })
  count: number;
}

export class TierDistributionItemDto {
  @ApiProperty({ example: 'Nano' })
  tier: string;

  @ApiProperty({ example: 1842 })
  count: number;

  @ApiProperty({ example: 47.9 })
  percentage: number;
}

export class GenderDistributionItemDto {
  @ApiProperty({ example: 'Female' })
  gender: string;

  @ApiProperty({ example: 1204 })
  count: number;

  @ApiProperty({ example: 31.3 })
  percentage: number;
}

export class CompletionDistributionItemDto {
  @ApiProperty({ example: '100%' })
  percentageLabel: string;

  @ApiProperty({ example: 1842 })
  count: number;
}

export class NicheBreakdownItemDto {
  @ApiProperty({ example: 'Tech' })
  niche: string;

  @ApiProperty({ example: 1842 })
  count: number;

  @ApiProperty({ example: 47.9 })
  percentage: number;
}

export class CountryBreakdownItemDto {
  @ApiProperty({ example: 'Nigeria' })
  country: string;

  @ApiProperty({ example: 1842 })
  count: number;

  @ApiProperty({ example: 47.9 })
  percentage: number;
}

export class TopCreatorWidgetDto {
  @ApiProperty({ example: 'uuid-1' })
  id: string;

  @ApiProperty({ example: 'Tolu Fashola' })
  name: string;

  @ApiProperty({ example: '@tolustyles' })
  handle: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 'Mega' })
  tier: string;

  @ApiProperty({ example: 28 })
  campaignsCount: number;

  @ApiProperty({ example: 2100000 })
  totalEarnings: number;
}

// ── Response Wrappers for Widget Endpoints ────────────────────────────────────

export class AdminCreatorSummaryResponseDto {
  @ApiProperty({ type: CreatorSummaryDto })
  summary: CreatorSummaryDto;

  @ApiProperty({ type: [CompletionDistributionItemDto] })
  profileCompletionDistribution: CompletionDistributionItemDto[];
}

export class AdminCreatorAnalyticsResponseDto {
  @ApiProperty({ type: CreatorSummaryDto })
  summary: CreatorSummaryDto;

  @ApiProperty({ type: [TimeSeriesPointDto] })
  signupGrowth: TimeSeriesPointDto[];

  @ApiProperty({ type: [TimeSeriesPointDto] })
  activeLogins: TimeSeriesPointDto[];

  @ApiProperty({ type: [TierDistributionItemDto] })
  tierDistribution: TierDistributionItemDto[];

  @ApiProperty({ type: [GenderDistributionItemDto] })
  genderDistribution: GenderDistributionItemDto[];

  @ApiProperty({ type: [CompletionDistributionItemDto] })
  profileCompletionDistribution: CompletionDistributionItemDto[];

  @ApiProperty({ type: [NicheBreakdownItemDto] })
  nicheBreakdown: NicheBreakdownItemDto[];

  @ApiProperty({ type: [CountryBreakdownItemDto] })
  countryBreakdown: CountryBreakdownItemDto[];
}

// ── Response DTOs for Creator Table Listing ───────────────────────────────────

export class AdminCreatorListItemDto {
  @ApiProperty({ example: 'uuid-1' })
  id: string;

  @ApiProperty({ example: '#CR-1042' })
  displayId: string;

  @ApiProperty({ example: 'Amara Osei' })
  name: string;

  @ApiProperty({ example: '@amara.creates' })
  username: string;

  @ApiProperty({ example: 'amara@email.com' })
  email: string;

  @ApiProperty({ example: 'MACRO' })
  tier: string;

  @ApiProperty({ example: ['Fashion'] })
  niches: string[];

  @ApiProperty({ example: { city: 'Lagos', country: 'Nigeria' } })
  location: { city: string | null; country: string | null };

  @ApiProperty({ example: 'Female' })
  gender: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 100 })
  profileCompletion: number;

  @ApiProperty({ example: ['instagram', 'tiktok'] })
  platformsConnected: string[];

  @ApiProperty({ example: 24 })
  campaignsCount: number;

  @ApiProperty({ example: 1200000 })
  totalEarnings: number;

  @ApiProperty({ example: '2026-06-15T10:00:00Z' })
  createdAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 3847 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 193 })
  totalPages: number;
}

export class AdminCreatorsListResponseDto {
  @ApiProperty({ type: [AdminCreatorListItemDto] })
  data: AdminCreatorListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
