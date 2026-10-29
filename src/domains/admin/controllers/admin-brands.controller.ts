import { Audit } from '../audit/audit.decorator';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminBrandsService } from '../services/admin-brands.service';
import { AdminNotesService } from '../services/admin-notes.service';
import {
  SuspendUserDto,
  BanUserDto,
  AdminModerationResponseDto,
} from '../dtos/admin-moderation.dto';
import {
  QueryBrandWidgetTimeFilterDto,
  QueryTopBrandsWidgetDto,
  QueryAdminBrandAnalyticsDto,
  QueryAdminBrandsListDto,
  AdminBrandSummaryResponseDto,
  TimeSeriesPointDto,
  TopBrandWidgetDto,
  IndustryBreakdownItemDto,
  BrandCountryBreakdownItemDto,
  AdminBrandAnalyticsResponseDto,
  AdminBrandsListResponseDto,
  AdminBrandProfileResponseDto,
  AdminBrandCampaignHistoryResponseDto,
  PaginationQueryDto,
} from '../dtos/admin-brands.dto';
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
export class AdminBrandsController {
  constructor(
    private readonly adminBrandsService: AdminBrandsService,
    private readonly adminNotesService: AdminNotesService,
  ) {}

  @Get('brands/summary')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get top KPI cards metrics & profile completion distribution for Advertisers/Brands',
  })
  @ApiResponse({ status: 200, type: AdminBrandSummaryResponseDto })
  async getBrandsSummary(): Promise<AdminBrandSummaryResponseDto> {
    return this.adminBrandsService.getBrandsSummary();
  }

  @Get('brands/signup-growth')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Advertisers Signup Growth time-series bar chart data',
  })
  @ApiResponse({ status: 200, type: [TimeSeriesPointDto] })
  async getSignupGrowth(
    @Query() query: QueryBrandWidgetTimeFilterDto,
  ): Promise<TimeSeriesPointDto[]> {
    return this.adminBrandsService.getSignupGrowth(query);
  }

  @Get('brands/active-users')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Advertisers Active Users (Logins) time-series bar chart data',
  })
  @ApiResponse({ status: 200, type: [TimeSeriesPointDto] })
  async getActiveUsers(
    @Query() query: QueryBrandWidgetTimeFilterDto,
  ): Promise<TimeSeriesPointDto[]> {
    return this.adminBrandsService.getActiveUsers(query);
  }

  @Get('brands/top-brands')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Top Brands ranking list',
  })
  @ApiResponse({ status: 200, type: [TopBrandWidgetDto] })
  async getTopBrands(@Query() query: QueryTopBrandsWidgetDto): Promise<TopBrandWidgetDto[]> {
    return this.adminBrandsService.getTopBrands(query);
  }

  @Get('brands/industry-breakdown')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Advertisers Industry Breakdown',
  })
  @ApiResponse({ status: 200, type: [IndustryBreakdownItemDto] })
  async getIndustryBreakdown(
    @Query() query: QueryBrandWidgetTimeFilterDto,
  ): Promise<IndustryBreakdownItemDto[]> {
    return this.adminBrandsService.getIndustryBreakdown(query);
  }

  @Get('brands/country-breakdown')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get filterable Advertisers Country Breakdown',
  })
  @ApiResponse({ status: 200, type: [BrandCountryBreakdownItemDto] })
  async getCountryBreakdown(
    @Query() query: QueryBrandWidgetTimeFilterDto,
  ): Promise<BrandCountryBreakdownItemDto[]> {
    return this.adminBrandsService.getCountryBreakdown(query);
  }

  @Get('brands/analytics')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get full combined Brand/Advertiser management analytics statistics for initial page load',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand analytics data retrieved successfully',
    type: AdminBrandAnalyticsResponseDto,
  })
  async getBrandsAnalytics(
    @Query() query: QueryAdminBrandAnalyticsDto,
  ): Promise<AdminBrandAnalyticsResponseDto> {
    return this.adminBrandsService.getBrandsAnalytics(query);
  }

  @Get('brands')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List and filter Advertisers/Brands for the table view',
  })
  @ApiResponse({
    status: 200,
    description: 'Advertisers list retrieved successfully',
    type: AdminBrandsListResponseDto,
  })
  async getBrandsList(
    @Query() query: QueryAdminBrandsListDto,
  ): Promise<AdminBrandsListResponseDto> {
    return this.adminBrandsService.getBrandsList(query);
  }

  @Get('brands/:id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full Brand Profile details and metrics overview for modal view' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiResponse({ status: 200, type: AdminBrandProfileResponseDto })
  async getBrandProfileDetails(@Param('id') id: string): Promise<AdminBrandProfileResponseDto> {
    return this.adminBrandsService.getBrandProfileDetails(id);
  }

  @Get('brands/:id/campaign-history')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get campaign creation history for a Brand' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiResponse({ status: 200, type: AdminBrandCampaignHistoryResponseDto })
  async getBrandCampaignHistory(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<AdminBrandCampaignHistoryResponseDto> {
    return this.adminBrandsService.getBrandCampaignHistory(id, query.page || 1, query.limit || 10);
  }

  // â”€â”€ Brand Internal Admin Notes CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('brands/:id/notes')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all internal admin notes for a Brand' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiResponse({ status: 200, type: [AdminNoteResponseDto] })
  async getBrandNotes(@Param('id') id: string): Promise<AdminNoteResponseDto[]> {
    return this.adminNotesService.getNotesForUser(id);
  }

  @Post('brands/:id/notes')
  @Audit('BRAND_NOTE_CREATED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an internal admin note for a Brand' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiResponse({ status: 201, type: AdminNoteResponseDto })
  async createBrandNote(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Body() dto: CreateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    const adminId = admin.id;
    return this.adminNotesService.createNote(adminId, id, dto);
  }

  @Patch('brands/:id/notes/:noteId')
  @Audit('BRAND_NOTE_UPDATED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an internal admin note for a Brand' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  @ApiResponse({ status: 200, type: AdminNoteResponseDto })
  async updateBrandNote(
    @Param('noteId') noteId: string,
    @CurrentUser() admin: User,
    @Body() dto: UpdateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    const adminId = admin.id;
    return this.adminNotesService.updateNote(adminId, noteId, dto);
  }

  @Delete('brands/:id/notes/:noteId')
  @Audit('BRAND_NOTE_DELETED', { targetUserParam: 'id' })
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an internal admin note for a Brand' })
  @ApiParam({ name: 'id', description: 'Brand User ID' })
  @ApiParam({ name: 'noteId', description: 'Note ID' })
  async deleteBrandNote(
    @Param('noteId') noteId: string,
    @CurrentUser() admin: User,
  ): Promise<void> {
    const adminId = admin.id;
    await this.adminNotesService.deleteNote(adminId, noteId);
  }

  // ── Brand Moderation Endpoints ────────────────────────────────────────────

  @Patch('brands/:id/suspend')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a brand account' })
  @ApiParam({
    name: 'id',
    description: 'Brand/Advertiser User ID',
    type: String,
    example: 'b0e9a826-665a-4933-913a-ff19e347adbb',
  })
  @ApiBody({ type: SuspendUserDto, required: false })
  @ApiResponse({ status: 200, type: AdminModerationResponseDto })
  async suspendBrand(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Body() dto: SuspendUserDto,
    @Req() req: Request,
  ): Promise<AdminModerationResponseDto> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminBrandsService.suspendBrand(admin, id, dto, ipAddress, userAgent);
  }

  @Patch('brands/:id/reactivate')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended brand account' })
  @ApiParam({
    name: 'id',
    description: 'Brand/Advertiser User ID',
    type: String,
    example: 'b0e9a826-665a-4933-913a-ff19e347adbb',
  })
  @ApiResponse({ status: 200, type: AdminModerationResponseDto })
  async reactivateBrand(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Req() req: Request,
  ): Promise<AdminModerationResponseDto> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminBrandsService.reactivateBrand(admin, id, ipAddress, userAgent);
  }

  @Post('brands/:id/ban')
  @Roles('owner', 'super_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently ban a brand account' })
  @ApiParam({
    name: 'id',
    description: 'Brand/Advertiser User ID',
    type: String,
    example: 'b0e9a826-665a-4933-913a-ff19e347adbb',
  })
  @ApiBody({ type: BanUserDto, required: false })
  @ApiResponse({ status: 200, type: AdminModerationResponseDto })
  async banBrand(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ): Promise<AdminModerationResponseDto> {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminBrandsService.banBrand(admin, id, dto, ipAddress, userAgent);
  }
}
