import {
  Controller,
  BadRequestException,
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
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { CampaignsService } from '../services/campaigns.service';
import { CreateCampaignDto } from '../dtos/create-campaign.dto';
import { UpdateCampaignDto } from '../dtos/update-campaign.dto';
import { ApplyCampaignDto } from '../dtos/apply-campaign.dto';
import { ReviewApplicationDto } from '../dtos/review-application.dto';
import { ReviewApplicationsBatchDto } from '../dtos/review-applications-batch.dto';
import { ValidateSelectionDto } from '../dtos/validate-selection.dto';
import { SubmitDraftDto } from '../dtos/submit-draft.dto';
import { SubmitLiveDto } from '../dtos/submit-live.dto';
import { VetDraftDto } from '../dtos/vet-draft.dto';
import { FindAllCampaignsQueryDto } from '../dtos/find-all-campaigns-query.dto';
import { CreateReviewDto } from '../dtos/create-review.dto';
import { Campaign } from '../entities/campaign.entity';
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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'amplificationAssetFile', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new campaign (brand only)' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — only brands can create campaigns' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateCampaignDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      amplificationAssetFile?: Express.Multer.File[];
    },
  ) {
    const coverImageFile = files?.coverImage?.[0];
    const amplificationAssetFile = files?.amplificationAssetFile?.[0];

    if (coverImageFile) {
      if (coverImageFile.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Cover image is too large. Max allowed size is 5MB.');
      }
      if (!/(jpeg|jpg|png|webp)$/i.test(coverImageFile.mimetype)) {
        throw new BadRequestException('Invalid cover image file type.');
      }
    }

    if (amplificationAssetFile) {
      if (amplificationAssetFile.size > 50 * 1024 * 1024) {
        throw new BadRequestException(
          'Amplification asset file is too large. Max allowed size is 50MB.',
        );
      }
    }

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
        creatorCategoryIds: dto.creatorCategoryIds,
        creatorCategoryId: dto.creatorCategoryId,
        preferredPlatformIds: dto.preferredPlatformIds,
        timeline: dto.timeline as Record<string, unknown> | undefined,
        creatorNicheId: dto.creatorNicheId,
        creatorNicheIds: dto.creatorNicheIds,
        campaignBrief: dto.campaignBrief,
        contentGuidelines,
        amplificationAsset: dto.amplificationAsset,
      },
      {
        coverImage: coverImageFile,
        amplificationAssetFile,
      },
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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'amplificationAssetFile', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a campaign draft or Step 2-4 edits (brand owner only)' })
  @ApiResponse({ status: 200, description: 'Campaign draft updated successfully' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCampaignDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      amplificationAssetFile?: Express.Multer.File[];
    },
  ) {
    const coverImageFile = files?.coverImage?.[0];
    const amplificationAssetFile = files?.amplificationAssetFile?.[0];

    if (coverImageFile) {
      if (coverImageFile.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Cover image is too large. Max allowed size is 5MB.');
      }
      if (!/(jpeg|jpg|png|webp)$/i.test(coverImageFile.mimetype)) {
        throw new BadRequestException('Invalid cover image file type.');
      }
    }

    if (amplificationAssetFile) {
      if (amplificationAssetFile.size > 50 * 1024 * 1024) {
        throw new BadRequestException(
          'Amplification asset file is too large. Max allowed size is 50MB.',
        );
      }
    }

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
      {
        coverImage: coverImageFile,
        amplificationAssetFile,
      },
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
  @ApiOperation({
    summary: 'Submit campaign draft and initialize Pandascrow payment escrow (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Campaign submitted and escrow initiated successfully' })
  async submit(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.campaignsService.submit(id, user.id);
    return {
      message: 'Campaign submitted successfully. Please complete checkout to go live.',
      campaign: result.campaign,
      payment: result.payment,
    };
  }

  @Post(':id/verify-payment')
  @Throttle({ default: THROTTLE_LIMITS.CAMPAIGN_CREATE })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify campaign payment via Pandascrow status lookup (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Campaign payment verified successfully' })
  async verifyPayment(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.campaignsService.verifyPayment(id, user.id);
    return result;
  }

  // ─── Public / Authenticated campaign listings ─────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary:
      '📌Get all campaigns (optionally filter and sort by status, platforms, niches, goals, etc.)',
  })
  @ApiExtraModels(Campaign)
  @ApiResponse({
    status: 200,
    description: 'List of campaigns retrieved with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(Campaign) },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            pages: { type: 'number' },
          },
        },
      },
    },
  })
  async findAll(@Query() query: FindAllCampaignsQueryDto, @CurrentUser() user?: User) {
    return this.campaignsService.findAll(query, user);
  }

  @Get('creator-categories')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all creator categories (Nano, Micro, Macro, Mega)' })
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
  @ApiOperation({
    summary: 'Get campaign applications submitted by the creator',
  })
  @ApiResponse({ status: 200, description: 'Creator applications retrieved' })
  async getMyApplications(@CurrentUser() user: User) {
    const applications = await this.campaignsService.getMyApplications(user.id);
    return {
      applications,
    };
  }

  @Get('applications/:appId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand', 'creator', 'admin', 'finance_admin', 'superadmin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get a single campaign application by ID (creator applicant, brand owner, or admin only)',
  })
  @ApiResponse({ status: 200, description: 'Application retrieved successfully' })
  async getApplicationById(@Param('appId') appId: string, @CurrentUser() user: User) {
    const userRole = user.role?.name || 'creator';
    const application = await this.campaignsService.getApplicationById(appId, user.id, userRole);
    return {
      application,
    };
  }

  @Get(':id')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.campaignsService.findById(
      id,
      user ? { id: user.id, role: user.role?.name ?? (user.role as unknown as string) } : undefined,
    );
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
  @ApiOperation({
    summary: 'Get applications submitted for a campaign (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Applications list retrieved' })
  async getApplications(@Param('id') campaignId: string, @CurrentUser() user: User) {
    const applications = await this.campaignsService.getCampaignApplications(campaignId, user.id);
    return {
      applications,
    };
  }

  @Post(':id/validate-selection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand', 'admin', 'superadmin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate selected creators total fees against available campaign pool budget',
  })
  @ApiResponse({ status: 200, description: 'Creator selection budget validation check completed' })
  validateSelection(@Param('id') campaignId: string, @Body() dto: ValidateSelectionDto) {
    return this.campaignsService.validateCreatorSelection(campaignId, dto.applicationIds);
  }

  @Patch(':id/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand', 'admin', 'superadmin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch review (accept/reject) creator campaign applications (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Applications reviewed successfully' })
  async reviewApplicationsBatch(
    @Param('id') campaignId: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewApplicationsBatchDto,
  ) {
    const callerRole = user.role?.name ?? (user.role as unknown as string) ?? 'brand';
    const applications = await this.campaignsService.reviewCampaignApplicationsBatch(
      campaignId,
      dto.applicationIds,
      user.id,
      dto.status,
      callerRole,
    );
    return {
      message: `Applications have been ${dto.status} successfully.`,
      applications,
    };
  }

  @Patch(':id/applications/:appId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand', 'admin', 'superadmin')
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
    const callerRole = user.role?.name ?? (user.role as unknown as string) ?? 'brand';
    const application = await this.campaignsService.reviewCampaignApplication(
      campaignId,
      appId,
      user.id,
      dto.status,
      callerRole,
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

  @Patch(':id/submissions/:submissionId/approve-live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approve live post link/proof of posting and schedule creator payout (brand owner only)',
  })
  @ApiResponse({ status: 200, description: 'Live post approved and payout scheduled successfully' })
  async approveLivePost(
    @Param('id') campaignId: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: User,
  ) {
    const submission = await this.campaignsService.approveLivePost(
      campaignId,
      submissionId,
      user.id,
    );
    return {
      message: 'Live proof of posting approved successfully. Creator payout scheduled in 30 days.',
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

  // ─── Delete Draft Campaign ─────────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete a campaign draft (brand owner only, draft status only)',
  })
  @ApiResponse({ status: 200, description: 'Campaign draft deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — campaign is not in draft status or not owned by you',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async deleteDraft(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.campaignsService.deleteDraft(id, user.id);
    return { message: 'Campaign deleted successfully.' };
  }

  // ─── Reviews & Star Ratings ────────────────────────────────────────────────

  @Post('reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit a star rating and written review for a creator after a campaign (brand owner only)',
  })
  @ApiResponse({ status: 201, description: 'Review submitted successfully' })
  async createReview(@Body() dto: CreateReviewDto, @CurrentUser() user: User) {
    const review = await this.campaignsService.submitReview(dto, user);
    return {
      message: 'Review submitted successfully.',
      review,
    };
  }

  @Get('reviews/creator/:creatorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all reviews for a creator (Portfolio)' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getCreatorReviews(@Param('creatorId') creatorId: string, @CurrentUser() user: User) {
    const reviews = await this.campaignsService.getCreatorReviews(creatorId, user);
    return {
      reviews,
    };
  }
}
