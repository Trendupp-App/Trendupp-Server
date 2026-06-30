import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { CampaignsService } from '../services/campaigns.service';
import { CreateCampaignDto } from '../dtos/create-campaign.dto';
import { UpdateCampaignDto } from '../dtos/update-campaign.dto';
import { ApplyCampaignDto } from '../dtos/apply-campaign.dto';
import { ReviewApplicationDto } from '../dtos/review-application.dto';
import { SubmitDraftDto } from '../dtos/submit-draft.dto';
import { SubmitLiveDto } from '../dtos/submit-live.dto';
import { VetDraftDto } from '../dtos/vet-draft.dto';
import { CreateFeeDto } from '../dtos/create-fee.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // ─── Brand creates a campaign ──────────────────────────────────────────────

  @Post()
  @Throttle({ default: THROTTLE_LIMITS.CAMPAIGN_CREATE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('coverImage'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new campaign (brand only)' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only brands can create campaigns' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateCampaignDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let contentGuidelines = dto.contentGuidelines;
    if (typeof contentGuidelines === 'string') {
      try {
        contentGuidelines = JSON.parse(contentGuidelines) as { dos: string[]; donts: string[] };
      } catch {
        // ignore invalid JSON
      }
    }

    const campaign = await this.campaignsService.create(
      user.id,
      {
        title: dto.title,
        goal: dto.goal,
        totalBudget: dto.totalBudget,
        creatorCategoryId: dto.creatorCategoryId,
        preferredPlatformIds: dto.preferredPlatformIds,
        timeline: dto.timeline,
        creatorNicheId: dto.creatorNicheId,
        campaignBrief: dto.campaignBrief,
        contentGuidelines,
      },
      file,
    );

    return {
      message: 'Campaign draft created successfully.',
      campaign,
    };
  }

  @Patch(':id')
  @Throttle({ default: THROTTLE_LIMITS.CAMPAIGN_CREATE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('coverImage'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a campaign draft or Step 2-4 edits (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Campaign draft updated successfully' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCampaignDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let contentGuidelines = dto.contentGuidelines;
    if (typeof contentGuidelines === 'string') {
      try {
        contentGuidelines = JSON.parse(contentGuidelines) as { dos: string[]; donts: string[] };
      } catch {
        // ignore invalid JSON
      }
    }

    let deliverables = dto.deliverables;
    if (typeof deliverables === 'string') {
      try {
        deliverables = JSON.parse(deliverables) as string[];
      } catch {
        // ignore invalid JSON
      }
    }

    let contentDirection = dto.contentDirection;
    if (typeof contentDirection === 'string') {
      try {
        contentDirection = JSON.parse(contentDirection) as string[];
      } catch {
        // ignore invalid JSON
      }
    }

    const campaign = await this.campaignsService.updateDraft(
      id,
      user.id,
      {
        ...dto,
        contentGuidelines,
        deliverables,
        contentDirection,
      },
      file,
    );

    return {
      message: 'Campaign draft updated successfully.',
      campaign,
    };
  }

  @Post(':id/submit')
  @Throttle({ default: THROTTLE_LIMITS.CAMPAIGN_CREATE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a campaign draft for review (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Campaign submitted for review successfully' })
  async submit(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.campaignsService.submit(id, user.id);
    return {
      message: 'Campaign submitted successfully. Please proceed to payment to finalize funding.',
      campaign: result.campaign,
      payment: result.payment,
    };
  }

  @Post(':id/pay')
  @Throttle({ default: THROTTLE_LIMITS.CAMPAIGN_CREATE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process simulated payment for a campaign (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Campaign payment completed successfully' })
  async pay(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('paymentReference') paymentReference?: string,
  ) {
    const result = await this.campaignsService.pay(id, user.id, paymentReference);
    return {
      message: 'Campaign funded successfully. It is now awaiting admin review.',
      ...result,
    };
  }

  // ─── Public / Authenticated campaign listings ─────────────────────────────

  @Get()
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Get all campaigns (optionally filter by status: draft | live | active | completed)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'live', 'active', 'completed'],
    description: 'Filter campaigns by status',
  })
  @ApiResponse({ status: 200, description: 'List of campaigns retrieved' })
  async findAll(@Query('status') status?: string) {
    if (status === 'live') {
      return this.campaignsService.findLive();
    }
    if (status === 'past') {
      return this.campaignsService.findPast();
    }
    return this.campaignsService.findAll(status);
  }

  @Get('creator-categories')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all creator categories (Nano, Micro, Mid-tier, Macro)' })
  @ApiResponse({ status: 200, description: 'List of creator categories' })
  getCreatorCategories() {
    return this.campaignsService.getCreatorCategories();
  }

  @Get('platforms')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all supported platforms (Instagram, TikTok, YouTube, Twitter)' })
  @ApiResponse({ status: 200, description: 'List of platforms' })
  getPlatforms() {
    return this.campaignsService.getPlatforms();
  }

  @Get('my')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get campaigns created by the authenticated brand' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'live', 'active', 'completed'],
    description: 'Filter my campaigns by status',
  })
  @ApiResponse({ status: 200, description: 'List of brand campaigns retrieved' })
  async findMyCampaigns(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.campaignsService.findByBrandId(user.id, status);
  }

  @Get('applications/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get campaign applications submitted by the creator' })
  @ApiResponse({ status: 200, description: 'Creator applications retrieved' })
  async getMyApplications(@CurrentUser() user: User) {
    const applications = await this.campaignsService.getMyApplications(user.id);
    return {
      applications,
    };
  }

  @Get(':id')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Post(':id/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply for a live campaign (creator only)' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async apply(
    @Param('id') campaignId: string,
    @CurrentUser() user: User,
    @Body() dto: ApplyCampaignDto,
  ) {
    const application = await this.campaignsService.applyToCampaign(campaignId, user.id, dto);
    return {
      message: 'Application submitted successfully.',
      application,
    };
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get applications submitted for a campaign (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Applications list retrieved' })
  async getApplications(@Param('id') campaignId: string, @CurrentUser() user: User) {
    const applications = await this.campaignsService.getCampaignApplications(campaignId, user.id);
    return {
      applications,
    };
  }

  @Patch(':id/applications/:appId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Review (accept/reject) a creator campaign application (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Application reviewed successfully' })
  async reviewApplication(
    @Param('id') campaignId: string,
    @Param('appId') appId: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewApplicationDto,
  ) {
    const application = await this.campaignsService.reviewCampaignApplication(
      campaignId,
      appId,
      user.id,
      dto.status,
    );
    return {
      message: `Application has been ${dto.status} successfully.`,
      application,
    };
  }

  // ─── Content Submissions Flow Endpoints ────────────────────────────────────

  @Post(':id/applications/:appId/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit or resubmit a content draft link (creator only)' })
  @ApiResponse({ status: 200, description: 'Draft link submitted successfully' })
  async submitDraft(
    @Param('id') campaignId: string,
    @Param('appId') appId: string,
    @CurrentUser() user: User,
    @Body() dto: SubmitDraftDto,
  ) {
    const submission = await this.campaignsService.submitDraft(
      campaignId,
      appId,
      user.id,
      dto.draftLink,
    );
    return {
      message: 'Content draft submitted successfully for review.',
      submission,
    };
  }

  @Patch(':id/submissions/:submissionId/vet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vet content draft — approve or request revision (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Draft vetted successfully' })
  async vetDraft(
    @Param('id') campaignId: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: User,
    @Body() dto: VetDraftDto,
  ) {
    const submission = await this.campaignsService.vetDraft(
      campaignId,
      submissionId,
      user.id,
      dto.decision,
      dto.brandFeedback,
    );
    return {
      message: `Draft content has been ${dto.decision === 'approved' ? 'approved' : 'rejected and revision requested'}.`,
      submission,
    };
  }

  @Post(':id/submissions/:submissionId/live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit live post link/proof of posting (creator only)' })
  @ApiResponse({ status: 200, description: 'Live link submitted successfully' })
  async submitLivePost(
    @Param('id') campaignId: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: User,
    @Body() dto: SubmitLiveDto,
  ) {
    const submission = await this.campaignsService.submitLivePost(
      campaignId,
      submissionId,
      user.id,
      dto.liveLink,
    );
    return {
      message: 'Proof of posting submitted successfully.',
      submission,
    };
  }

  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get deliverables/submissions for a campaign (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Deliverables retrieved successfully' })
  async getSubmissions(@Param('id') campaignId: string, @CurrentUser() user: User) {
    const submissions = await this.campaignsService.getSubmittedContent(campaignId, user.id);
    return {
      submissions,
    };
  }

  // ─── Admin Fees Management Endpoints ─────────────────────────────────────

  @Get('fees')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active fees/charges' })
  @ApiResponse({ status: 200, description: 'List of fees retrieved' })
  async getFees() {
    const fees = await this.campaignsService.getFees();
    return { fees };
  }

  @Post('fees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new fee configuration (admin only)' })
  @ApiResponse({ status: 201, description: 'Fee created successfully' })
  async createFee(@Body() dto: CreateFeeDto) {
    const fee = await this.campaignsService.createFee(dto);
    return {
      message: 'Fee configuration created successfully.',
      fee,
    };
  }

  @Delete('fees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a fee configuration permanently (admin only)' })
  @ApiResponse({ status: 200, description: 'Fee configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Fee configuration not found' })
  async deleteFee(@Param('id') id: string) {
    await this.campaignsService.deleteFee(id);
    return {
      message: 'Fee configuration deleted permanently.',
    };
  }
}
