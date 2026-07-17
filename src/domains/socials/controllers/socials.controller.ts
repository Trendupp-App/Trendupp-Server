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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { SocialsService } from '../services/socials.service';
import { ConnectSocialDto } from '../dtos/connect-social.dto';
import { SOCIAL_PLATFORMS } from '../constants/social-platforms';

@ApiTags('socials')
@ApiBearerAuth()
@Controller('socials')
@UseGuards(JwtAuthGuard)
export class SocialsController {
  constructor(private readonly socialsService: SocialsService) {}

  @Get()
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'List all social platforms and the current connection status' })
  @ApiResponse({ status: 200, description: 'Connection status for every supported platform' })
  list(@CurrentUser() user: User) {
    return this.socialsService.list(user.id);
  }

  @Post(':platform/connect')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'platform', enum: SOCIAL_PLATFORMS })
  @ApiOperation({
    summary: 'Connect a social account via OAuth and verify its follower count',
  })
  @ApiResponse({ status: 200, description: 'Connected successfully; returns updated tier' })
  @ApiResponse({ status: 400, description: 'Unsupported platform' })
  @ApiResponse({ status: 401, description: 'Invalid OAuth code / token exchange failed' })
  @ApiResponse({
    status: 422,
    description: 'Account does not meet the minimum follower requirement',
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
  @ApiOperation({ summary: 'Re-verify the follower count for an already-connected platform' })
  @ApiResponse({ status: 200, description: 'Stats refreshed; returns updated tier' })
  @ApiResponse({ status: 404, description: 'Platform is not connected' })
  @ApiResponse({ status: 409, description: 'Reconnect required (no stored token)' })
  refresh(@CurrentUser() user: User, @Param('platform') platform: string) {
    return this.socialsService.refresh(user.id, platform);
  }

  @Delete(':platform')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'platform', enum: SOCIAL_PLATFORMS })
  @ApiOperation({ summary: 'Disconnect a social account' })
  @ApiResponse({ status: 200, description: 'Disconnected; returns updated tier' })
  disconnect(@CurrentUser() user: User, @Param('platform') platform: string) {
    return this.socialsService.disconnect(user.id, platform);
  }
}
