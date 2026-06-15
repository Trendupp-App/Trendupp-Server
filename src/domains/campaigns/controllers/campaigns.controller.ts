import {
  Controller,
  Get,
  Post,
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
    const campaign = await this.campaignsService.create(
      user.id,
      {
        title: dto.title,
        goal: dto.goal,
        totalBudget: dto.totalBudget,
        paymentPerCreator: dto.paymentPerCreator,
        creatorCategoryId: dto.creatorCategoryId,
        preferredPlatformIds: dto.preferredPlatformIds,
        contentType: dto.contentType,
        duration: dto.duration,
        contentDuration: dto.contentDuration,
        contentGuidelines: dto.contentGuidelines,
        campaignRules: dto.campaignRules,
      },
      file,
    );

    return {
      message: 'Campaign created successfully. It is pending admin approval.',
      campaign,
    };
  }

  // ─── Public / Authenticated campaign listings ─────────────────────────────

  @Get()
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Get all campaigns (optionally filter by status: live | past)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['live', 'past'],
    description: 'Filter campaigns by lifecycle status',
  })
  @ApiResponse({ status: 200, description: 'List of campaigns retrieved' })
  async findAll(@Query('status') status?: string) {
    if (status === 'live') {
      return this.campaignsService.findLive();
    }
    if (status === 'past') {
      return this.campaignsService.findPast();
    }
    return this.campaignsService.findAll();
  }

  @Get('my')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get campaigns created by the authenticated brand' })
  @ApiResponse({ status: 200, description: 'List of brand campaigns retrieved' })
  async findMyCampaigns(@CurrentUser() user: User) {
    return this.campaignsService.findByBrandId(user.id);
  }

  @Get(':id')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }
}
