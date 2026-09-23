import {
  Controller,
  Get,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminCampaignsService } from '../services/admin-campaigns.service';
import { CampaignsService } from '../../campaigns/services/campaigns.service';
import {
  QueryAdminCampaignsListDto,
  AdminCampaignSummaryResponseDto,
  AdminCampaignsListResponseDto,
} from '../dtos/admin-campaigns.dto';
import {
  CancelAdminCampaignDto,
  PauseAdminCampaignDto,
  ResumeAdminCampaignDto,
} from '../dtos/admin-cancel-campaign.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminCampaignsController {
  constructor(
    private readonly adminCampaignsService: AdminCampaignsService,
    private readonly campaignsService: CampaignsService,
  ) {}

  @Get('campaigns/summary')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get Paid Campaigns Overview summary KPI cards (Total, Draft, Live, Active, Completed, Cancelled)',
  })
  @ApiResponse({ status: 200, type: AdminCampaignSummaryResponseDto })
  async getCampaignsSummary(): Promise<AdminCampaignSummaryResponseDto> {
    return this.adminCampaignsService.getCampaignsSummary();
  }

  @Get('campaigns')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List and filter campaigns for the Admin Campaigns table view',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaigns list retrieved successfully',
    type: AdminCampaignsListResponseDto,
  })
  async getCampaignsList(
    @Query() query: QueryAdminCampaignsListDto,
  ): Promise<AdminCampaignsListResponseDto> {
    return this.adminCampaignsService.getCampaignsList(query);
  }

  @Get('campaigns/:id/activity-timeline')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get chronological activity timeline events feed for a campaign (Admin tab)',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign activity timeline feed retrieved successfully',
  })
  async getActivityTimeline(@Param('id') id: string) {
    return this.campaignsService.getActivityTimeline(id);
  }

  @Patch('campaigns/:id/cancel')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel a campaign as Admin (evaluates 100% payout for submission creators, 50% for non-submission accepted creators scheduled for 30 days, plus brand refund)',
  })
  @ApiResponse({ status: 200, description: 'Campaign cancelled successfully' })
  async cancelCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CancelAdminCampaignDto,
    @Req() req: Record<string, unknown>,
  ) {
    const reqObj = req as { ip?: string; headers?: Record<string, string> };
    const ipAddress = reqObj.ip || reqObj.headers?.['x-forwarded-for'] || '';
    const userAgent = reqObj.headers?.['user-agent'] || '';
    return this.adminCampaignsService.cancelCampaign(user.id, id, dto, ipAddress, userAgent);
  }

  @Patch('campaigns/:id/pause')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause a Paid Campaign as Admin (suspends all campaign activity)',
  })
  @ApiResponse({ status: 200, description: 'Campaign paused successfully' })
  async pauseCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: PauseAdminCampaignDto,
    @Req() req: Record<string, unknown>,
  ) {
    const reqObj = req as { ip?: string; headers?: Record<string, string> };
    const ipAddress = reqObj.ip || reqObj.headers?.['x-forwarded-for'] || '';
    const userAgent = reqObj.headers?.['user-agent'] || '';
    return this.adminCampaignsService.pauseCampaign(user.id, id, dto, ipAddress, userAgent);
  }

  @Patch('campaigns/:id/resume')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume a paused Paid Campaign as Admin',
  })
  @ApiResponse({ status: 200, description: 'Campaign resumed successfully' })
  async resumeCampaign(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ResumeAdminCampaignDto,
    @Req() req: Record<string, unknown>,
  ) {
    const reqObj = req as { ip?: string; headers?: Record<string, string> };
    const ipAddress = reqObj.ip || reqObj.headers?.['x-forwarded-for'] || '';
    const userAgent = reqObj.headers?.['user-agent'] || '';
    return this.adminCampaignsService.resumeCampaign(user.id, id, dto, ipAddress, userAgent);
  }
}
