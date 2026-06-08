import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ConflictException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { OnboardingService } from '../services/onboarding.service';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { SetNichesDto } from '../dtos/set-niches.dto';
import { UpdateSocialsDto } from '../dtos/update-socials.dto';
import { VerifyIdentityDto } from '../dtos/verify-identity.dto';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';

@ApiTags('onboarding')
@ApiSecurity('onboarding-key')
@Controller('users/onboarding')
@UseGuards(ApiKeyGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly usersService: UsersService,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'Get all available roles for onboarding' })
  @ApiResponse({ status: 200, description: 'List of roles retrieved' })
  async getRoles(@Query('publicOnly') publicOnly?: string): Promise<Role[]> {
    const isPublicOnly = publicOnly === 'true' || publicOnly === '1';
    return this.usersService.findAllRoles(isPublicOnly);
  }

  @Get('niches')
  @ApiOperation({ summary: 'Get all sorted niches for onboarding selection' })
  @ApiResponse({ status: 200, description: 'List of niches retrieved' })
  async getNiches() {
    return this.onboardingService.getAllNiches();
  }

  @Get('nationalities')
  @ApiOperation({ summary: 'Get all nationalities/countries' })
  @ApiResponse({ status: 200, description: 'List of nationalities retrieved' })
  async getNationalities() {
    return this.onboardingService.getAllNationalities();
  }

  @Get('nationalities/:nationalityId/states')
  @ApiOperation({ summary: 'Get states belonging to a specific nationality' })
  @ApiResponse({ status: 200, description: 'List of states retrieved' })
  async getStates(@Param('nationalityId') nationalityId: string) {
    return this.onboardingService.getStatesByNationality(nationalityId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1: Build user profile (username, nationality, state, bio)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Username is already taken');
    }

    await this.usersService.update(user.id, {
      username: dto.username,
      nationalityId: dto.nationalityId,
      stateId: dto.stateId,
      bio: dto.bio,
    });

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Profile details updated successfully',
      user: {
        id: updated?.id,
        username: updated?.username,
        nationalityId: updated?.nationalityId,
        stateId: updated?.stateId,
        bio: updated?.bio,
        onboardingPercentage: updated?.onboardingPercentage,
      },
    };
  }

  @Post('niches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Save selected niches' })
  @ApiResponse({ status: 200, description: 'User niches saved successfully' })
  async setNiches(@CurrentUser() user: User, @Body() dto: SetNichesDto) {
    await this.usersService.setUserNiches(user.id, dto.nicheIds);

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Niches associated successfully',
      user: {
        id: updated?.id,
        onboardingPercentage: updated?.onboardingPercentage,
        niches: updated?.niches,
      },
    };
  }

  @Patch('socials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Connect social profiles' })
  @ApiResponse({
    status: 200,
    description: 'Social accounts connected successfully and tier assigned',
  })
  async updateSocials(@CurrentUser() user: User, @Body() dto: UpdateSocialsDto) {
    const updates: Partial<User> = {};

    if (dto.instagramUsername !== undefined) updates.instagramUsername = dto.instagramUsername;
    if (dto.instagramFollowers !== undefined) updates.instagramFollowers = dto.instagramFollowers;
    if (dto.tiktokUsername !== undefined) updates.tiktokUsername = dto.tiktokUsername;
    if (dto.tiktokFollowers !== undefined) updates.tiktokFollowers = dto.tiktokFollowers;
    if (dto.youtubeUsername !== undefined) updates.youtubeUsername = dto.youtubeUsername;
    if (dto.youtubeFollowers !== undefined) updates.youtubeFollowers = dto.youtubeFollowers;
    if (dto.twitterUsername !== undefined) updates.twitterUsername = dto.twitterUsername;
    if (dto.twitterFollowers !== undefined) updates.twitterFollowers = dto.twitterFollowers;

    // Resolve details to calculate tier automatically based on highest followers
    const currentInstaFollowers =
      dto.instagramFollowers !== undefined ? dto.instagramFollowers : user.instagramFollowers;
    const currentTiktokFollowers =
      dto.tiktokFollowers !== undefined ? dto.tiktokFollowers : user.tiktokFollowers;
    const currentYoutubeFollowers =
      dto.youtubeFollowers !== undefined ? dto.youtubeFollowers : user.youtubeFollowers;
    const currentTwitterFollowers =
      dto.twitterFollowers !== undefined ? dto.twitterFollowers : user.twitterFollowers;

    const maxFollowers = Math.max(
      currentInstaFollowers || 0,
      currentTiktokFollowers || 0,
      currentYoutubeFollowers || 0,
      currentTwitterFollowers || 0,
    );

    let tier = 'Nano Creator';
    if (maxFollowers >= 500000) {
      tier = 'Macro Creator';
    } else if (maxFollowers >= 100000) {
      tier = 'Mid-tier Creator';
    } else if (maxFollowers >= 10000) {
      tier = 'Micro Creator';
    }

    updates.assignedTier = tier;

    await this.usersService.update(user.id, updates);

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Socials connected successfully',
      user: {
        id: updated?.id,
        instagramUsername: updated?.instagramUsername,
        instagramFollowers: updated?.instagramFollowers,
        tiktokUsername: updated?.tiktokUsername,
        tiktokFollowers: updated?.tiktokFollowers,
        youtubeUsername: updated?.youtubeUsername,
        youtubeFollowers: updated?.youtubeFollowers,
        twitterUsername: updated?.twitterUsername,
        twitterFollowers: updated?.twitterFollowers,
        assignedTier: updated?.assignedTier,
        onboardingPercentage: updated?.onboardingPercentage,
      },
    };
  }

  @Post('verify-identity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 4: Upload selfie verification video for admin review' })
  @ApiResponse({ status: 200, description: 'Verification video submitted successfully' })
  async verifyIdentity(@CurrentUser() user: User, @Body() dto: VerifyIdentityDto) {
    await this.usersService.update(user.id, {
      verificationVideoUrl: dto.verificationVideoUrl,
      verificationStatus: 'pending',
    });

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Identity verification video submitted successfully. Profile is under review.',
      user: {
        id: updated?.id,
        verificationVideoUrl: updated?.verificationVideoUrl,
        verificationStatus: updated?.verificationStatus,
        onboardingPercentage: updated?.onboardingPercentage,
      },
    };
  }
}
