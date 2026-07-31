import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Audit } from '../../admin/audit/audit.decorator';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { PostMetricsRepository } from '../repository/post-metrics.repository';
import { PostMediaResolverService } from '../services/post-media-resolver.service';
import { PostMetricsService } from '../services/post-metrics.service';
import { MetricSnapshotDto } from '../dtos/post-metrics-response.dto';

/**
 * Staff tooling for post-metric collection. Namespaced under /admin and
 * staff-role-guarded so it is never confused with the advertiser-facing
 * /post-metrics endpoints.
 *
 * The two manual actions exist because collection depends on third-party APIs
 * that fail in ways only a human can judge: a post that resolves as `unowned`
 * is either a fraud signal or a URL the creator pasted wrong, and support
 * needs to be able to retry after the creator reconnects.
 */
@ApiTags('admin-post-metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
@Controller('admin/post-metrics')
export class AdminPostMetricsController {
  constructor(
    private readonly repository: PostMetricsRepository,
    private readonly resolver: PostMediaResolverService,
    private readonly metrics: PostMetricsService,
  ) {}

  @Get('unresolved')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: "Live posts that could not be tied to the creator's account",
    description:
      'Triage queue. `unowned` means the URL was not found in the connected account at all ' +
      '(a fraud signal); `unauthorized` means the creator must reconnect the platform to ' +
      'grant insights scopes; `unsupported` usually means a short/share link was submitted ' +
      'instead of a direct permalink.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async unresolved(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const media = await this.repository.findPendingResolution(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50,
    );

    return media.map((m) => ({
      id: m.id,
      submissionId: m.submissionId,
      campaignId: m.campaignId,
      creatorId: m.creatorId,
      platform: m.platform,
      url: m.url,
      resolutionStatus: m.resolutionStatus,
      resolutionError: m.resolutionError ?? null,
      createdAt: m.createdAt,
    }));
  }

  @Post(':mediaId/resolve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @ApiParam({ name: 'mediaId', format: 'uuid' })
  @Audit('POST_METRICS_RESOLVE_RETRIED')
  @ApiOperation({
    summary: 'Retry ownership resolution for one live post',
    description:
      'Use after the creator reconnects the platform or corrects the URL. Re-checks the ' +
      "creator's own media listing and updates the resolution status.",
  })
  @ApiResponse({ status: 404, description: 'Post media not found' })
  async resolve(@Param('mediaId', ParseUUIDPipe) mediaId: string) {
    const media = await this.resolver.resolve(mediaId);
    if (!media) throw new NotFoundException('Post media not found');

    return {
      id: media.id,
      resolutionStatus: media.resolutionStatus,
      resolutionError: media.resolutionError ?? null,
      ownershipVerified: media.ownershipVerified,
      platformMediaId: media.platformMediaId ?? null,
      mediaType: media.mediaType ?? null,
      publishedAt: media.publishedAt ?? null,
    };
  }

  @Post(':mediaId/capture')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @ApiParam({ name: 'mediaId', format: 'uuid' })
  @Audit('POST_METRICS_SNAPSHOT_CAPTURED')
  @ApiOperation({
    summary: 'Capture a metrics snapshot now',
    description:
      'Writes an extra snapshot labelled `manual` without disturbing the scheduled ' +
      't24h/t7d/t30d windows. Snapshots are append-only, so this can never overwrite ' +
      'a scheduled reading.',
  })
  @ApiOkResponse({ type: MetricSnapshotDto })
  @ApiResponse({
    status: 404,
    description: 'Media not found, or not in a resolved state that can be captured',
  })
  async capture(@Param('mediaId', ParseUUIDPipe) mediaId: string): Promise<MetricSnapshotDto> {
    const snapshot = await this.metrics.captureSnapshot(mediaId, 'manual');
    if (!snapshot) {
      throw new NotFoundException(
        'Could not capture: the post is not resolved, not owned by the creator, or the ' +
          'platform rejected the stored token',
      );
    }

    return {
      id: snapshot.id,
      windowLabel: snapshot.windowLabel,
      capturedAt: snapshot.capturedAt,
      views: snapshot.views ?? null,
      likes: snapshot.likes ?? null,
      comments: snapshot.comments ?? null,
      shares: snapshot.shares ?? null,
      saves: snapshot.saves ?? null,
      reach: snapshot.reach ?? null,
      followerCount: snapshot.followerCount ?? null,
    };
  }
}
