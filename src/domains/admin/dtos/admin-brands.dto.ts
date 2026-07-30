import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  TimeSeriesPointDto,
  CompletionDistributionItemDto,
  PaginationMetaDto,
  BankDetailsDto,
} from './admin-creators.dto';

export { TimeSeriesPointDto };

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class QueryBrandWidgetTimeFilterDto {
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

export class QueryTopBrandsWidgetDto {
  @ApiPropertyOptional({ example: '2026-06-01', description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 5, default: 5, description: 'Number of top brands to fetch' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 5;
}

export class QueryAdminBrandAnalyticsDto extends QueryBrandWidgetTimeFilterDto {}

export class QueryAdminBrandsListDto {
  @ApiPropertyOptional({
    example: 'pepsi',
    description: 'Search term for brand name, rep name or email',
  })
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

  @ApiPropertyOptional({ example: 'ind-uuid-1', description: 'Filter by industry ID' })
  @IsOptional()
  @IsString()
  industryId?: string;

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

export class BrandSummaryDto {
  @ApiProperty({ example: 3847 })
  totalAdvertisers: number;

  @ApiProperty({ example: 3124 })
  profileCompleted: number;

  @ApiProperty({ example: 187 })
  suspendedAdvertisers: number;

  @ApiProperty({ example: 536 })
  pendingProfileCompletion: number;
}

export class IndustryBreakdownItemDto {
  @ApiProperty({ example: 'Tech' })
  industry: string;

  @ApiProperty({ example: 1842 })
  count: number;

  @ApiProperty({ example: 47.9 })
  percentage: number;
}

export class BrandCountryBreakdownItemDto {
  @ApiProperty({ example: 'Nigeria' })
  country: string;

  @ApiProperty({ example: 1842 })
  count: number;

  @ApiProperty({ example: 47.9 })
  percentage: number;
}

export class TopBrandWidgetDto {
  @ApiProperty({ example: 'uuid-1' })
  id: string;

  @ApiProperty({ example: 'Pepsi Nigeria' })
  brandName: string;

  @ApiProperty({ example: 'www.pepsi.ng', nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ example: 'https://...', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 28 })
  campaignsCount: number;

  @ApiProperty({ example: 2100000 })
  totalSpend: number;
}

export class AdminBrandSummaryResponseDto {
  @ApiProperty({ type: BrandSummaryDto })
  summary: BrandSummaryDto;

  @ApiProperty({ type: [CompletionDistributionItemDto] })
  profileCompletionDistribution: CompletionDistributionItemDto[];
}

export class AdminBrandAnalyticsResponseDto {
  @ApiProperty({ type: BrandSummaryDto })
  summary: BrandSummaryDto;

  @ApiProperty({ type: [TimeSeriesPointDto] })
  signupGrowth: TimeSeriesPointDto[];

  @ApiProperty({ type: [TimeSeriesPointDto] })
  activeLogins: TimeSeriesPointDto[];

  @ApiProperty({ type: [TopBrandWidgetDto] })
  topBrands: TopBrandWidgetDto[];

  @ApiProperty({ type: [CompletionDistributionItemDto] })
  profileCompletionDistribution: CompletionDistributionItemDto[];

  @ApiProperty({ type: [IndustryBreakdownItemDto] })
  industryBreakdown: IndustryBreakdownItemDto[];

  @ApiProperty({ type: [BrandCountryBreakdownItemDto] })
  countryBreakdown: BrandCountryBreakdownItemDto[];
}

// ── Advertisers Table Listing DTOs ────────────────────────────────────────────

export class AdminAdvertiserListItemDto {
  @ApiProperty({ example: 'uuid-1' })
  id: string;

  @ApiProperty({ example: '#AD-1001' })
  displayId: string;

  @ApiProperty({
    example: { brandName: 'Pepsi Nigeria', logoUrl: 'https://...' },
  })
  advertiser: { brandName: string; logoUrl: string | null };

  @ApiProperty({
    example: { name: 'Emeka Obi', email: 'emeka@pepsi.ng' },
  })
  representative: { name: string; email: string };

  @ApiProperty({ example: 'Beverages' })
  industry: string;

  @ApiProperty({ example: { city: 'Lagos', country: 'Nigeria' } })
  location: { city: string | null; country: string | null };

  @ApiProperty({ example: 100 })
  profileCompletion: number;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 4500000 })
  totalSpend: number;

  @ApiProperty({ example: 14 })
  campaignsCount: number;

  @ApiProperty({ example: '2023-10-12T00:00:00Z' })
  joinDate: Date;
}

export class AdminBrandsListResponseDto {
  @ApiProperty({ type: [AdminAdvertiserListItemDto] })
  data: AdminAdvertiserListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

// ── Brand Profile Modal DTOs ──────────────────────────────────────────────────

export class BrandHeaderInfoDto {
  @ApiProperty({ example: 'Pepsi Nigeria' })
  brandName: string;

  @ApiProperty({ example: 'pepsi.com.ng', nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ example: 'https://...', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'FMCG' })
  industry: string;

  @ApiProperty({ example: 'Active' })
  status: string;
}

export class BrandDetailsInfoDto {
  @ApiProperty({ example: 'Pepsi Company' })
  brandName: string;

  @ApiProperty({ example: 'pepsi@email.com' })
  email: string;

  @ApiProperty({ example: 'www.pepsi.com.ng', nullable: true })
  website: string | null;

  @ApiProperty({ example: 'A brand committed to refreshing moments...', nullable: true })
  bio: string | null;

  @ApiProperty({ example: 'Nigeria' })
  country: string;

  @ApiProperty({ example: 'Lagos/Ikeja', nullable: true })
  stateCity: string | null;

  @ApiProperty({ example: '₦4.7M', nullable: true })
  monthlyBudget: string | null;
}

export class BrandRepresentativeInfoDto {
  @ApiProperty({ example: 'Chisom Mary' })
  fullName: string;

  @ApiProperty({ example: 'amara@email.com' })
  email: string;

  @ApiProperty({ example: '+2348077238262', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ example: 100 })
  profileCompletion: number;

  @ApiProperty({ example: 'Jan 15, 2026' })
  dateJoined: string;

  @ApiProperty({ example: 'Active' })
  accountStatus: string;
}

export class BrandMetricsInfoDto {
  @ApiProperty({ example: 14 })
  totalCampaigns: number;

  @ApiProperty({ example: 28000000 })
  totalSpend: number;

  @ApiProperty({ example: 3 })
  activeCampaigns: number;

  @ApiProperty({ example: 4.7 })
  avgCreatorRating: number;
}

export class AdminBrandProfileResponseDto {
  @ApiProperty({ type: BrandHeaderInfoDto })
  header: BrandHeaderInfoDto;

  @ApiProperty({ type: BrandDetailsInfoDto })
  brandDetails: BrandDetailsInfoDto;

  @ApiProperty({ type: BrandRepresentativeInfoDto })
  brandRepresentative: BrandRepresentativeInfoDto;

  @ApiProperty({ type: BrandMetricsInfoDto })
  metrics: BrandMetricsInfoDto;

  @ApiProperty({ type: BankDetailsDto, nullable: true })
  bankDetails: BankDetailsDto | null;
}

// ── Brand Campaign History DTOs ───────────────────────────────────────────────

export class BrandCampaignHistoryItemDto {
  @ApiProperty({ example: 'uuid-1' })
  id: string;

  @ApiProperty({ example: 'Summer Launch Campaign' })
  title: string;

  @ApiProperty({ example: 'paid', description: 'Campaign type: paid or social_impact' })
  type: string;

  @ApiProperty({ example: 2500000 })
  totalBudget: number;

  @ApiProperty({ example: 2000000, description: 'Net campaign budget for creator payouts after fee deductions' })
  amount: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: 5000 })
  gatewayFee: number;

  @ApiProperty({ example: 0.15 })
  commissionRate: number;

  @ApiProperty({ example: 0.075 })
  vatRate: number;

  @ApiProperty({ example: 0.03 })
  gatewayRate: number;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 'PAID' })
  paymentStatus: string;

  @ApiProperty({ example: 12 })
  applicationsCount: number;

  @ApiProperty({ example: '2026-06-01', nullable: true })
  startDate: Date | null;

  @ApiProperty({ example: '2026-07-01', nullable: true })
  endDate: Date | null;

  @ApiProperty({ example: '2026-05-15T00:00:00Z' })
  createdAt: Date;
}

export class AdminBrandCampaignHistoryResponseDto {
  @ApiProperty({ type: [BrandCampaignHistoryItemDto] })
  data: BrandCampaignHistoryItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
