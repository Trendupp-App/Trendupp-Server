import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { CampaignRepository } from '../../campaigns/repository/campaign.repository';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import {
  PLATFORM_METRIC_SUPPORT,
  REQUIRED_INSIGHTS_SCOPES,
  SAVES_IS_APPROXIMATE,
} from '../post-metrics.constants';
import { PostMetricsService } from '../services/post-metrics.service';
import {
  CampaignMetricsDto,
  MediaHistoryDto,
  PlatformCapabilityDto,
  SubmissionMetricsDto,
} from '../dtos/post-metrics-response.dto';
import { PLATFORM_LABELS, SOCIAL_PLATFORMS } from '../../socials/constants/social-platforms';

const STAFF_ROLES = [
  'owner',
  'admin',
  'superadmin',
  'super_admin',
  'finance_admin',
  'moderator',
  'support_agent',
];

/**
 * Post-campaign performance reporting for advertisers.
 *
 * Every metric is either a real platform reading or explicitly marked
 * unavailable with a reason — nothing is defaulted to 0, and cross-platform
 * totals are only emitted for metrics every platform in the set can supply.
 * See PLATFORM_METRIC_SUPPORT for why (reach does not exist on TikTok,
 * YouTube or X; saves does not exist on Facebook).
 */
@ApiTags('post-metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('post-metrics')
export class PostMetricsController {
  constructor(
    private readonly service: PostMetricsService,
    private readonly campaignRepository: CampaignRepository,
  ) {}

  @Get('capabilities')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Which metrics each platform can report for a single post',
    description:
      'Static capability matrix. Clients should use this to label or hide metrics per ' +
      'platform instead of hard-coding assumptions — a `false` here is a permanent platform ' +
      'limitation, not a pending feature.',
  })
  @ApiOkResponse({ type: [PlatformCapabilityDto] })
  capabilities(): PlatformCapabilityDto[] {
    return SOCIAL_PLATFORMS.map((platform) => ({
      platform,
      platformLabel: PLATFORM_LABELS[platform],
      supports: PLATFORM_METRIC_SUPPORT[platform],
      savesApproximation: SAVES_IS_APPROXIMATE[platform],
      requiredScopes: REQUIRED_INSIGHTS_SCOPES[platform],
    }));
  }

  @Get('submissions/:submissionId')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiParam({ name: 'submissionId', format: 'uuid' })
  @ApiOperation({
    summary: 'Latest metrics for one live post submission',
    description:
      'Returns one block per platform the creator posted on. Check ' +
      '`metrics.<key>.available` before rendering a value, and treat ' +
      '`notComparableAcrossPlatforms` as "show per-platform only, do not total".',
  })
  @ApiOkResponse({ type: SubmissionMetricsDto })
  @ApiResponse({ status: 403, description: 'Not the brand, creator, or staff for this submission' })
  @ApiResponse({ status: 404, description: 'No live posts registered for this submission yet' })
  async submissionMetrics(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentUser() user: User,
  ): Promise<SubmissionMetricsDto> {
    await this.assertSubmissionAccess(submissionId, user);
    return this.service.getSubmissionMetrics(submissionId);
  }

  @Get('campaigns/:campaignId')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiParam({ name: 'campaignId', format: 'uuid' })
  @ApiOperation({
    summary: 'Campaign-wide performance roll-up',
    description:
      'Every verified live post on the campaign, plus totals for the metrics that are ' +
      'comparable across the platforms actually used. Posts whose ownership could not be ' +
      'verified are listed with their resolution status but excluded from all totals.',
  })
  @ApiOkResponse({ type: CampaignMetricsDto })
  @ApiResponse({ status: 403, description: 'Not the campaign owner or staff' })
  async campaignMetrics(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentUser() user: User,
  ): Promise<CampaignMetricsDto> {
    await this.assertCampaignAccess(campaignId, user);
    return this.service.getCampaignMetrics(campaignId);
  }

  @Get('media/:mediaId/history')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiParam({ name: 'mediaId', format: 'uuid' })
  @ApiOperation({
    summary: 'Every capture for one post, oldest first',
    description:
      'Platform APIs return cumulative point-in-time counters with no history, so growth ' +
      'over the campaign window is derived by diffing consecutive snapshots here.',
  })
  @ApiOkResponse({ type: MediaHistoryDto })
  async mediaHistory(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: User,
  ): Promise<MediaHistoryDto> {
    const { media, snapshots } = await this.service.getMediaHistory(mediaId);
    await this.assertCampaignAccess(media.campaignId, user, media.creatorId);

    return {
      mediaId: media.id,
      platform: media.platform,
      url: media.url,
      snapshots: snapshots.map((s) => ({
        id: s.id,
        windowLabel: s.windowLabel,
        capturedAt: s.capturedAt,
        views: s.views ?? null,
        likes: s.likes ?? null,
        comments: s.comments ?? null,
        shares: s.shares ?? null,
        saves: s.saves ?? null,
        reach: s.reach ?? null,
        followerCount: s.followerCount ?? null,
      })),
    };
  }

  /** Brand that owns the campaign, the creator who posted, or staff. */
  private async assertCampaignAccess(
    campaignId: string,
    user: User,
    creatorId?: string,
  ): Promise<void> {
    if (this.isStaff(user)) return;
    if (creatorId && user.id === creatorId) return;

    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.brandId === user.id) return;

    throw new ForbiddenException("You do not have access to this campaign's performance data");
  }

  private async assertSubmissionAccess(submissionId: string, user: User): Promise<void> {
    if (this.isStaff(user)) return;

    const submission = await this.campaignRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.creatorId === user.id) return;

    await this.assertCampaignAccess(submission.campaignId, user, submission.creatorId);
  }

  private isStaff(user: User): boolean {
    const role = (user.role?.name ?? '').toLowerCase();
    return STAFF_ROLES.includes(role);
  }
}
