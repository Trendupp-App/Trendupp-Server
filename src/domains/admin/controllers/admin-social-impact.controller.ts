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
import { AdminSocialImpactService } from '../services/admin-social-impact.service';
import {
  TokenBatchResponseDto,
  AdminSocialImpactSummaryResponseDto,
  QueryAdminSocialImpactListDto,
  SocialImpactCampaignsListResponseDto,
  CreateSocialImpactCampaignDto,
  UpdateSocialImpactCampaignDto,
  SocialImpactCampaignDetailDto,
  QuerySocialImpactParticipantsDto,
  SocialImpactParticipantsListResponseDto,
  ReviewParticipantSubmissionDto,
  SocialImpactAdminActionDto,
} from '../dtos/admin-social-impact.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminSocialImpactController {
  constructor(private readonly adminSocialImpactService: AdminSocialImpactService) {}

  @Get('social-impact/token-batches')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available seeded Token Batches for creator rewards dropdown',
  })
  @ApiResponse({ status: 200, type: [TokenBatchResponseDto] })
  async getTokenBatches(): Promise<TokenBatchResponseDto[]> {
    return this.adminSocialImpactService.getTokenBatches();
  }

  @Get('social-impact/summary')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get Social Impact Overview summary KPI cards (Active, Participations, Tokens, Completed)',
  })
  @ApiResponse({ status: 200, type: AdminSocialImpactSummaryResponseDto })
  async getSocialImpactSummary(): Promise<AdminSocialImpactSummaryResponseDto> {
    return this.adminSocialImpactService.getSocialImpactSummary();
  }

  @Get('social-impact')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List and filter Social Impact Campaigns by status tabs (Draft, Live, Active, Completed)',
  })
  @ApiResponse({ status: 200, type: SocialImpactCampaignsListResponseDto })
  async getSocialImpactList(
    @Query() query: QueryAdminSocialImpactListDto,
  ): Promise<SocialImpactCampaignsListResponseDto> {
    return this.adminSocialImpactService.getSocialImpactList(query);
  }

  @Post('social-impact')
  @Audit('CREATE_SOCIAL_IMPACT')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a new Social Impact Campaign (Step 1, 2, or 3 wizard, save as draft or publish)',
  })
  async createSocialImpactCampaign(
    @Body() dto: CreateSocialImpactCampaignDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.createSocialImpactCampaign(dto, admin.id);
    return {
      message:
        dto.isDraft !== false ? 'Social Impact draft saved' : 'Social Impact campaign published',
      campaign,
    };
  }

  @Get('social-impact/:id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get full Social Impact Campaign details, brief, deliverables, guidelines & token rewards',
  })
  @ApiResponse({ status: 200, type: SocialImpactCampaignDetailDto })
  async getSocialImpactDetails(@Param('id') id: string): Promise<SocialImpactCampaignDetailDto> {
    return this.adminSocialImpactService.getSocialImpactDetails(id);
  }

  @Patch('social-impact/:id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an existing Social Impact Campaign draft or section',
  })
  async updateSocialImpactCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateSocialImpactCampaignDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.updateSocialImpactCampaign(
      id,
      dto,
      admin.id,
    );
    return {
      message: 'Social Impact campaign updated successfully',
      campaign,
    };
  }

  @Post('social-impact/:id/publish')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish a Social Impact Campaign draft to LIVE status',
  })
  async publishSocialImpactCampaign(@Param('id') id: string, @CurrentUser() admin: User) {
    const campaign = await this.adminSocialImpactService.publishSocialImpactCampaign(id, admin.id);
    return {
      message: 'Social Impact campaign published successfully',
      campaign,
    };
  }

  @Delete('social-impact/:id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete a Social Impact Campaign draft or campaign',
  })
  async deleteSocialImpactCampaign(
    @Param('id') id: string,
    @CurrentUser() admin: User,
  ): Promise<{ success: boolean; message: string }> {
    await this.adminSocialImpactService.deleteSocialImpactCampaign(id, admin.id);
    return {
      success: true,
      message: 'Social Impact campaign deleted successfully',
    };
  }

  @Get('social-impact/:id/participants')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List and filter creator participants for a Social Impact Campaign by submission status',
  })
  @ApiResponse({ status: 200, type: SocialImpactParticipantsListResponseDto })
  async getParticipants(
    @Param('id') id: string,
    @Query() query: QuerySocialImpactParticipantsDto,
  ): Promise<SocialImpactParticipantsListResponseDto> {
    return this.adminSocialImpactService.getParticipants(id, query);
  }

  @Post('social-impact/:id/participants/:appId/approve')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a participant submission and award tokens',
  })
  async approveParticipant(
    @Param('id') id: string,
    @Param('appId') appId: string,
    @CurrentUser() admin: User,
  ) {
    return this.adminSocialImpactService.approveParticipant(id, appId, admin.id);
  }

  @Post('social-impact/:id/participants/:appId/reject')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a participant submission with feedback reason',
  })
  async rejectParticipant(
    @Param('id') id: string,
    @Param('appId') appId: string,
    @Body() dto: ReviewParticipantSubmissionDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminSocialImpactService.rejectParticipant(id, appId, dto, admin.id);
  }

  @Post('social-impact/:id/pause')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause an active Social Impact Campaign' })
  async pauseCampaign(
    @Param('id') id: string,
    @Body() dto: SocialImpactAdminActionDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.pauseCampaign(id, dto, admin.id);
    return { message: 'Social Impact campaign paused', campaign };
  }

  @Post('social-impact/:id/cancel')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently cancel a Social Impact Campaign' })
  async cancelCampaign(
    @Param('id') id: string,
    @Body() dto: SocialImpactAdminActionDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.cancelCampaign(id, dto, admin.id);
    return { message: 'Social Impact campaign cancelled', campaign };
  }

  @Post('social-impact/:id/extend-deadline')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend submission deadline for a Social Impact Campaign' })
  async extendDeadline(
    @Param('id') id: string,
    @Body() dto: SocialImpactAdminActionDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.extendDeadline(id, dto, admin.id);
    return { message: 'Social Impact campaign deadline extended', campaign };
  }

  @Post('social-impact/:id/close-applications')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close application window for a Social Impact Campaign' })
  async closeApplications(
    @Param('id') id: string,
    @Body() dto: SocialImpactAdminActionDto,
    @CurrentUser() admin: User,
  ) {
    const campaign = await this.adminSocialImpactService.closeApplications(id, dto, admin.id);
    return { message: 'Social Impact campaign applications closed', campaign };
  }
}
