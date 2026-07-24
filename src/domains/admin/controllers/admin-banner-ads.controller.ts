import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BannerAdsService } from '../services/banner-ads.service';
import {
  CreateBannerAdDto,
  UpdateBannerAdDto,
  UpdateBannerAdStatusDto,
  QueryBannerAdsDto,
  BannerAdSummaryResponseDto,
} from '../dtos/banner-ad.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin/ads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminBannerAdsController {
  constructor(private readonly bannerAdsService: BannerAdsService) {}

  @Get('summary')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Ad Management KPI Summary cards (Total Active, Impressions, CTR, Expiring Soon)',
  })
  @ApiResponse({ status: 200, type: BannerAdSummaryResponseDto })
  async getAdminAdsSummary(): Promise<BannerAdSummaryResponseDto> {
    return this.bannerAdsService.getAdminAdsSummary();
  }

  @Get()
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all Banner Ads with filtering and pagination for Admin Dashboard',
  })
  @ApiResponse({ status: 200, description: 'Banner Ads list retrieved successfully' })
  async getAdminAdsList(@Query() query: QueryBannerAdsDto) {
    return this.bannerAdsService.getAdminAdsList(query);
  }

  @Post()
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new Banner Ad (Save Draft or Publish)' })
  @ApiResponse({ status: 201, description: 'Banner Ad created successfully' })
  async createAd(@Body() dto: CreateBannerAdDto) {
    return this.bannerAdsService.createAd(dto);
  }

  @Get(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get single Banner Ad details' })
  @ApiResponse({ status: 200, description: 'Banner Ad details retrieved successfully' })
  async getAdById(@Param('id') id: string) {
    return this.bannerAdsService.getAdById(id);
  }

  @Patch(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing Banner Ad' })
  @ApiResponse({ status: 200, description: 'Banner Ad updated successfully' })
  async updateAd(@Param('id') id: string, @Body() dto: UpdateBannerAdDto) {
    return this.bannerAdsService.updateAd(id, dto);
  }

  @Patch(':id/status')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update Banner Ad status (active, paused, draft)' })
  @ApiResponse({ status: 200, description: 'Banner Ad status updated successfully' })
  async updateAdStatus(@Param('id') id: string, @Body() dto: UpdateBannerAdStatusDto) {
    return this.bannerAdsService.updateAdStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Banner Ad' })
  @ApiResponse({ status: 204, description: 'Banner Ad deleted successfully' })
  async deleteAd(@Param('id') id: string) {
    await this.bannerAdsService.deleteAd(id);
  }
}
