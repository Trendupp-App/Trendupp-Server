import { ApiProperty } from '@nestjs/swagger';

export class TopMetricsDto {
  @ApiProperty({ example: 3847, description: 'Total registered creator users' })
  totalCreators: number;

  @ApiProperty({ example: 142000, description: 'Total registered brand users' })
  totalBrands: number;

  @ApiProperty({ example: 28400, description: 'Total campaigns created' })
  totalCampaigns: number;

  @ApiProperty({ example: 4, description: 'Total open/unresolved disputes' })
  openDisputes: number;

  @ApiProperty({ example: 12, description: 'Brands registered in the last 7 days' })
  newBrandsThisWeek: number;

  @ApiProperty({ example: 8, description: 'Campaigns created in the last 7 days' })
  newCampaignsThisWeek: number;

  @ApiProperty({ example: 2, description: 'Disputes raised in the last 7 days' })
  newDisputesThisWeek: number;
}

export class ActionsRequiredDto {
  @ApiProperty({ example: 4, description: 'Number of unresolved disputes' })
  unresolvedDisputes: number;

  @ApiProperty({ example: 12, description: 'Number of resolved disputes' })
  resolvedDisputes: number;

  @ApiProperty({ example: 11, description: 'Number of creators awaiting payment release' })
  creatorsAwaitingPayment: number;

  @ApiProperty({ example: 0, description: 'Payout releases in failed status needing attention' })
  failedPayouts: number;
}

export class CampaignOverviewDto {
  @ApiProperty({ example: 284, description: 'Total campaigns count' })
  total: number;

  @ApiProperty({ example: 18, description: 'Draft status campaigns count' })
  draft: number;

  @ApiProperty({ example: 41, description: 'Live status campaigns count' })
  live: number;

  @ApiProperty({ example: 62, description: 'Active status campaigns count' })
  active: number;

  @ApiProperty({ example: 9, description: 'Post pending status campaigns count' })
  postPending: number;

  @ApiProperty({ example: 128, description: 'Completed status campaigns count' })
  completed: number;
}

export class TierMetricDto {
  @ApiProperty({ example: 'Nano', description: 'Tier category name' })
  name: string;

  @ApiProperty({ example: 1842, description: 'Count of registered creators in tier' })
  count: number;

  @ApiProperty({ example: 47.9, description: 'Percentage of total creators' })
  percentage: number;
}

export class CreatorTiersDto {
  @ApiProperty({ example: 3847, description: 'Total registered creators' })
  totalRegistered: number;

  @ApiProperty({ example: 23, description: 'Creator profiles pending verification' })
  pendingVerification: number;

  @ApiProperty({ example: 124, description: 'Creators registered in the last 7 days' })
  newThisWeek: number;

  @ApiProperty({ type: [TierMetricDto], description: 'Breakdown of creator tiers' })
  tiers: TierMetricDto[];
}

export class RecentCampaignDto {
  @ApiProperty({ example: 'TRD-1001', description: 'Display ID or campaign UUID' })
  id: string;

  @ApiProperty({ example: 'Summer Style Collection', description: 'Campaign title' })
  title: string;

  @ApiProperty({ example: 'Zara Africa', description: 'Brand user name' })
  brandName: string;

  @ApiProperty({ example: 'https://...', description: 'Brand avatar URL', nullable: true })
  brandAvatar: string | null;

  @ApiProperty({ example: 'live', description: 'Campaign lifecycle status' })
  status: string;

  @ApiProperty({ example: 3000000, description: 'Total budget' })
  budget: number;

  @ApiProperty({ example: 47, description: 'Total applications count' })
  applicationsCount: number;
}

export class TopCreatorDto {
  @ApiProperty({ example: 'uuid-1', description: 'Creator user ID' })
  id: string;

  @ApiProperty({ example: 'Tolu Fashola', description: 'Creator full name' })
  name: string;

  @ApiProperty({ example: '@tolustyles', description: 'Creator username or handle' })
  handle: string;

  @ApiProperty({ example: 'https://...', description: 'Avatar URL', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 'Mega', description: 'Assigned tier' })
  tier: string;

  @ApiProperty({ example: 28, description: 'Completed campaigns count' })
  completedCampaigns: number;

  @ApiProperty({ example: 2100000, description: 'Total earnings' })
  totalEarnings: number;
}

export class AdminOverviewResponseDto {
  @ApiProperty({ type: TopMetricsDto })
  topMetrics: TopMetricsDto;

  @ApiProperty({ type: ActionsRequiredDto })
  actionsRequired: ActionsRequiredDto;

  @ApiProperty({ type: CampaignOverviewDto })
  campaignOverview: CampaignOverviewDto;

  @ApiProperty({ type: CreatorTiersDto })
  creatorTiers: CreatorTiersDto;

  @ApiProperty({ type: [RecentCampaignDto] })
  recentCampaignActivity: RecentCampaignDto[];

  @ApiProperty({ type: [TopCreatorDto] })
  topCreators: TopCreatorDto[];
}
