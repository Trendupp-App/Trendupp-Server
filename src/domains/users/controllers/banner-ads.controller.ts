import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BannerAdsService } from '../../admin/services/banner-ads.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('ads')
@Controller('ads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BannerAdsController {
  constructor(private readonly bannerAdsService: BannerAdsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get active banner ads for authenticated user (matching placement & target audience)',
  })
  @ApiQuery({ name: 'placement', required: false, example: 'Home Page' })
  @ApiResponse({ status: 200, description: 'Active banner ads retrieved successfully' })
  async getActiveAds(@Query('placement') placement?: string) {
    return this.bannerAdsService.getActiveAdsForUser(placement);
  }

  @Post(':id/impression')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record an impression view for a banner ad (5-minute user deduplication)',
  })
  @ApiResponse({ status: 200, description: 'Impression recorded' })
  async recordImpression(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bannerAdsService.recordImpression(id, user.id);
  }

  @Post(':id/click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a click on a banner ad and return target linkUrl' })
  @ApiResponse({ status: 200, description: 'Click recorded' })
  async recordClick(@Param('id') id: string) {
    return this.bannerAdsService.recordClick(id);
  }
}
