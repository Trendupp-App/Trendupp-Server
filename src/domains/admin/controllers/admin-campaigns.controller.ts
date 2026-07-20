import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminCampaignsService } from '../services/admin-campaigns.service';
import {
  QueryAdminCampaignsListDto,
  AdminCampaignSummaryResponseDto,
  AdminCampaignsListResponseDto,
} from '../dtos/admin-campaigns.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminCampaignsController {
  constructor(private readonly adminCampaignsService: AdminCampaignsService) {}

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
}
