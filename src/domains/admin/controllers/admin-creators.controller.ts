import { Audit } from '../audit/audit.decorator';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminCreatorsService } from '../services/admin-creators.service';
import { AdminNotesService } from '../services/admin-notes.service';
import {
  QueryWidgetTimeFilterDto,
  QueryTopCreatorsWidgetDto,
  QueryAdminCreatorAnalyticsDto,
  QueryAdminCreatorsListDto,
  AdminCreatorSummaryResponseDto,
  TimeSeriesPointDto,
  TopCreatorWidgetDto,
  TierDistributionItemDto,
  GenderDistributionItemDto,
  NicheBreakdownItemDto,
  CountryBreakdownItemDto,
  AdminCreatorAnalyticsResponseDto,
  AdminCreatorsListResponseDto,
  AdminCreatorProfileResponseDto,
  AdminCreatorCampaignHistoryResponseDto,
  AdminCreatorReviewsResponseDto,
} from '../dtos/admin-creators.dto';
import {
  CreateAdminNoteDto,
  UpdateAdminNoteDto,
  AdminNoteResponseDto,
} from '../dtos/admin-notes.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminCreatorsController {
  constructor(
    private readonly adminCreatorsService: AdminCreatorsService,
    private readonly adminNotesService: AdminNotesService,
  ) {}

  @Get('creators/summary')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get static top KPI cards metrics & profile completion distribution',
  })
  @ApiResponse({ status: 200, type: AdminCreatorSummaryResponseDto })
  async getCreatorsSummary(): Promise<AdminCreatorSummaryResponseDto> {
    return this.adminCreatorsService.getCreatorsSummary();
  }

  @Get('creators/signup-growth')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Signup Growth time-series bar chart data',
  })
  @ApiResponse({ status: 200, type: [TimeSeriesPointDto] })
  async getSignupGrowth(@Query() query: QueryWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    return this.adminCreatorsService.getSignupGrowth(query);
  }

  @Get('creators/active-users')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Active Users (Logins) time-series bar chart data',
  })
  @ApiResponse({ status: 200, type: [TimeSeriesPointDto] })
  async getActiveUsers(@Query() query: QueryWidgetTimeFilterDto): Promise<TimeSeriesPointDto[]> {
    return this.adminCreatorsService.getActiveUsers(query);
  }

  @Get('creators/top-creators')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Top Creators ranking list',
  })
  @ApiResponse({ status: 200, type: [TopCreatorWidgetDto] })
  async getTopCreators(@Query() query: QueryTopCreatorsWidgetDto): Promise<TopCreatorWidgetDto[]> {
    return this.adminCreatorsService.getTopCreators(query);
  }

  @Get('creators/tier-distribution')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Creator Tier Distribution (Nano, Micro, Macro, Mega)',
  })
  @ApiResponse({ status: 200, type: [TierDistributionItemDto] })
  async getTierDistribution(
    @Query() query: QueryWidgetTimeFilterDto,
  ): Promise<TierDistributionItemDto[]> {
    return this.adminCreatorsService.getTierDistribution(query);
  }

  @Get('creators/gender-distribution')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Gender Distribution breakdown',
  })
  @ApiResponse({ status: 200, type: [GenderDistributionItemDto] })
  async getGenderDistribution(
    @Query() query: QueryWidgetTimeFilterDto,
  ): Promise<GenderDistributionItemDto[]> {
    return this.adminCreatorsService.getGenderDistribution(query);
  }

  @Get('creators/niche-breakdown')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Creator Niche Breakdown',
  })
  @ApiResponse({ status: 200, type: [NicheBreakdownItemDto] })
  async getNicheBreakdown(
    @Query() query: QueryWidgetTimeFilterDto,
  ): Promise<NicheBreakdownItemDto[]> {
    return this.adminCreatorsService.getNicheBreakdown(query);
  }

  @Get('creators/country-breakdown')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Creator Country Breakdown',
  })
  @ApiResponse({ status: 200, type: [CountryBreakdownItemDto] })
  async getCountryBreakdown(
    @Query() query: QueryWidgetTimeFilterDto,
  ): Promise<CountryBreakdownItemDto[]> {
    return this.adminCreatorsService.getCountryBreakdown(query);
  }

  @Get('creators/analytics')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full combined Creator Management analytics statistics for initial page load',
  })
  @ApiResponse({
    status: 200,
    description: 'Creator analytics data retrieved successfully',
    type: AdminCreatorAnalyticsResponseDto,
  })
  async getCreatorsAnalytics(
    @Query() query: QueryAdminCreatorAnalyticsDto,
  ): Promise<AdminCreatorAnalyticsResponseDto> {
    return this.adminCreatorsService.getCreatorsAnalytics(query);
  }

  @Get('creators')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List and filter creators for the Creator Management table view',
  })
  @ApiResponse({
    status: 200,
    description: 'Creators list retrieved successfully',
    type: AdminCreatorsListResponseDto,
  })
  async getCreatorsList(
    @Query() query: QueryAdminCreatorsListDto,
  ): Promise<AdminCreatorsListResponseDto> {
    return this.adminCreatorsService.getCreatorsList(query);
  }

  // ── Creator Detailed Profile Modal Endpoints ────────────────────────────────

  @Get('creators/:id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get detailed creator profile overview, metrics cards, and social accounts',
  })
  @ApiResponse({ status: 200, type: AdminCreatorProfileResponseDto })
  async getCreatorProfileDetails(@Param('id') id: string): Promise<AdminCreatorProfileResponseDto> {
    return this.adminCreatorsService.getCreatorProfileDetails(id);
  }

  @Get('creators/:id/campaign-history')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated campaign history for a creator',
  })
  @ApiResponse({ status: 200, type: AdminCreatorCampaignHistoryResponseDto })
  async getCreatorCampaignHistory(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<AdminCreatorCampaignHistoryResponseDto> {
    return this.adminCreatorsService.getCreatorCampaignHistory(id, page, limit);
  }

  @Get('creators/:id/reviews')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get ratings and brand reviews for a creator',
  })
  @ApiResponse({ status: 200, type: AdminCreatorReviewsResponseDto })
  async getCreatorReviews(@Param('id') id: string): Promise<AdminCreatorReviewsResponseDto> {
    return this.adminCreatorsService.getCreatorReviews(id);
  }

  // ── Internal Admin Notes Endpoints ──────────────────────────────────────────

  @Get('creators/:id/notes')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all internal admin notes written for a creator',
  })
  @ApiResponse({ status: 200, type: [AdminNoteResponseDto] })
  async getCreatorNotes(@Param('id') id: string): Promise<AdminNoteResponseDto[]> {
    return this.adminNotesService.getNotesForUser(id);
  }

  @Post('creators/:id/notes')
  @Audit('CREATOR_NOTE_CREATED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an internal admin note for a creator',
  })
  @ApiResponse({ status: 201, type: AdminNoteResponseDto })
  async createCreatorNote(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Body() dto: CreateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    return this.adminNotesService.createNote(admin.id, id, dto);
  }

  @Patch('creators/:id/notes/:noteId')
  @Audit('CREATOR_NOTE_UPDATED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an existing internal admin note',
  })
  @ApiResponse({ status: 200, type: AdminNoteResponseDto })
  async updateCreatorNote(
    @Param('noteId') noteId: string,
    @CurrentUser() admin: User,
    @Body() dto: UpdateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    return this.adminNotesService.updateNote(admin.id, noteId, dto);
  }

  @Delete('creators/:id/notes/:noteId')
  @Audit('CREATOR_NOTE_DELETED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an internal admin note',
  })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  async deleteCreatorNote(
    @Param('noteId') noteId: string,
    @CurrentUser() admin: User,
  ): Promise<{ success: boolean }> {
    return this.adminNotesService.deleteNote(admin.id, noteId);
  }
}
