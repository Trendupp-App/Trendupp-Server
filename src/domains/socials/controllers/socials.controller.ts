import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { SocialsService } from '../services/socials.service';
import { ConnectSocialDto } from '../dtos/connect-social.dto';
import {
  SocialConnectionViewDto,
  SocialsMutationResultDto,
} from '../dtos/social-connection-response.dto';
import { SOCIAL_PLATFORMS } from '../constants/social-platforms';

@ApiTags('socials')
@ApiBearerAuth()
@Controller('socials')
@UseGuards(JwtAuthGuard)
export class SocialsController {
  constructor(private readonly socialsService: SocialsService) {}

  @Get()
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'List all social platforms and the current connection status',
    description:
      'Returns one card per supported platform (instagram, tiktok, youtube, twitter) with ' +
      'connection state, OAuth-verified username/follower count, and the minimum follower ' +
      'requirement (runtime-editable via the social_platform_settings table).',
  })
  @ApiOkResponse({
    description: 'Connection status for every supported platform',
    type: [SocialConnectionViewDto],
  })
  list(@CurrentUser() user: User) {
    return this.socialsService.list(user.id);
  }

  @Post(':platform/connect')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'platform', enum: SOCIAL_PLATFORMS })
  @ApiOperation({
    summary: 'Connect a social account via OAuth and verify its follower count',
    description:
      'Exchanges the OAuth authorization code with the platform server-side, reads the ' +
      'identity and follower count from the platform API (never from the client), enforces ' +
      'the follower minimum, recomputes the creator tier, and sends a social.connected ' +
      'notification. One social account can back at most one Trendupp profile.',
  })
  @ApiOkResponse({
    description: 'Connected successfully; returns updated tier and all platform cards',
    type: SocialsMutationResultDto,
  })
  @ApiResponse({ status: 400, description: 'Unsupported platform' })
  @ApiResponse({ status: 401, description: 'Invalid OAuth code / token exchange failed' })
  @ApiResponse({
    status: 409,
    description: 'This platform account is already linked to another Trendupp profile',
  })
  @ApiResponse({
    status: 422,
    description: 'Account does not meet the minimum follower requirement',
  })
  @ApiResponse({
    status: 503,
    description: 'Platform integration is not configured on this server',
  })
  connect(
    @CurrentUser() user: User,
    @Param('platform') platform: string,
    @Body() dto: ConnectSocialDto,
  ) {
    return this.socialsService.connect(user.id, platform, dto);
  }

  @Post(':platform/refresh')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'platform', enum: SOCIAL_PLATFORMS })
  @ApiOperation({
    summary: 'Re-verify the follower count for an already-connected platform',
    description:
      'Re-pulls follower stats from the platform API using the stored access token and ' +
      'recomputes the creator tier.',
  })
  @ApiOkResponse({
    description: 'Stats refreshed; returns updated tier and all platform cards',
    type: SocialsMutationResultDto,
  })
  @ApiResponse({ status: 404, description: 'Platform is not connected' })
  @ApiResponse({ status: 409, description: 'Reconnect required (no stored token)' })
  refresh(@CurrentUser() user: User, @Param('platform') platform: string) {
    return this.socialsService.refresh(user.id, platform);
  }

  @Delete(':platform')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'platform', enum: SOCIAL_PLATFORMS })
  @ApiOperation({
    summary: 'Disconnect a social account',
    description:
      'Hard-deletes the connection (frees the account for future reconnects), clears the ' +
      'denormalized user columns, recomputes the creator tier from the remaining ' +
      'connections, and sends a social.disconnected security notification.',
  })
  @ApiOkResponse({
    description: 'Disconnected; returns updated tier and all platform cards',
    type: SocialsMutationResultDto,
  })
  disconnect(@CurrentUser() user: User, @Param('platform') platform: string) {
    return this.socialsService.disconnect(user.id, platform);
  }
}
