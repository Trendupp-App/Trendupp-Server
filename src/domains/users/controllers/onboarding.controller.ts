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
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { OnboardingService } from '../services/onboarding.service';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { SetNichesDto } from '../dtos/set-niches.dto';
import { UpdateSocialsDto } from '../dtos/update-socials.dto';
import { UpdatePayoutDto } from '../dtos/update-payout.dto';
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
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all available roles for onboarding' })
  @ApiResponse({ status: 200, description: 'List of roles retrieved' })
  async getRoles(@Query('publicOnly') publicOnly?: string): Promise<Role[]> {
    const isPublicOnly = publicOnly === 'true' || publicOnly === '1';
    return this.usersService.findAllRoles(isPublicOnly);
  }

  @Get('niches')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all sorted niches for onboarding selection' })
  @ApiResponse({ status: 200, description: 'List of niches retrieved' })
  async getNiches() {
    return this.onboardingService.getAllNiches();
  }

  // ─── Nationality Lookup (citizenship / passport) ───────────────────────────

  @Get('nationalities')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all nationalities (citizenship/passport options)' })
  @ApiResponse({ status: 200, description: 'List of nationalities retrieved' })
  async getNationalities() {
    return this.onboardingService.getAllNationalities();
  }

  @Get('nationalities/:nationalityId/states')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get states belonging to a specific nationality' })
  @ApiResponse({ status: 200, description: 'List of states retrieved' })
  async getStatesByNationality(@Param('nationalityId') nationalityId: string) {
    return this.onboardingService.getStatesByNationality(nationalityId);
  }

  // ─── Country Lookup (operating country — same data as nationalities) ───────

  @Get('countries')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Get all countries (operating-country options — same dataset as nationalities)',
  })
  @ApiResponse({ status: 200, description: 'List of countries retrieved' })
  async getCountries() {
    // Reuses the nationalities table — same seeded data, different semantic context.
    return this.onboardingService.getAllNationalities();
  }

  @Get('countries/:countryId/states')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get states belonging to a specific country' })
  @ApiResponse({ status: 200, description: 'List of states retrieved' })
  async getStatesByCountry(@Param('countryId') countryId: string) {
    // Delegates to the same repository query as getStatesByNationality —
    // country_id and nationality_id both reference the nationalities table.
    return this.onboardingService.getStatesByNationality(countryId);
  }

  // ─── Onboarding Steps ──────────────────────────────────────────────────────

  @Patch('profile')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 1: Build user profile (username, nationality, country, state, bio)',
  })
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
      countryId: dto.countryId,
      stateId: dto.stateId,
      bio: dto.bio,
    });

    const updated = await this.usersService.findOneWithNiches(user.id);
    const defaultSteps = { profile: false, niches: false, socials: false, payout: false };
    return {
      message: 'Profile details updated successfully',
      user: {
        id: updated?.id,
        firstName: updated?.firstName,
        lastName: updated?.lastName,
        username: updated?.username,
        nationality: updated?.nationality
          ? { id: updated.nationality.id, name: updated.nationality.name }
          : null,
        country: updated?.country ? { id: updated.country.id, name: updated.country.name } : null,
        state: updated?.state ? { id: updated.state.id, name: updated.state.name } : null,
        bio: updated?.bio,
        onboardingPercentage: updated?.onboardingPercentage,
        onboardingStepsCompleted: updated?.onboardingStepsCompleted ?? defaultSteps,
      },
    };
  }

  @Post('niches')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Save selected niches' })
  @ApiResponse({ status: 200, description: 'User niches saved successfully' })
  async setNiches(@CurrentUser() user: User, @Body() dto: SetNichesDto) {
    await this.usersService.setUserNiches(user.id, dto.nicheIds);

    const updated = await this.usersService.findOneWithNiches(user.id);
    const defaultSteps = { profile: false, niches: false, socials: false, payout: false };
    return {
      message: 'Niches associated successfully',
      user: {
        id: updated?.id,
        onboardingPercentage: updated?.onboardingPercentage,
        onboardingStepsCompleted: updated?.onboardingStepsCompleted ?? defaultSteps,
        niches: updated?.niches,
      },
    };
  }

  @Patch('socials')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
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
    const defaultSteps = { profile: false, niches: false, socials: false, payout: false };
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
        onboardingStepsCompleted: updated?.onboardingStepsCompleted ?? defaultSteps,
      },
    };
  }

  @Patch('payout')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 4: Save payout details (bank account for campaign payment via escrow)',
  })
  @ApiResponse({ status: 200, description: 'Payout details saved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePayout(@CurrentUser() user: User, @Body() dto: UpdatePayoutDto) {
    await this.usersService.update(user.id, {
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      bankAccountName: dto.bankAccountName,
    });

    const updated = await this.usersService.findOneWithNiches(user.id);
    const defaultSteps = { profile: false, niches: false, socials: false, payout: false };
    return {
      message: 'Payout details saved successfully',
      user: {
        id: updated?.id,
        bankName: updated?.bankName,
        bankAccountNumber: updated?.bankAccountNumber,
        bankAccountName: updated?.bankAccountName,
        onboardingPercentage: updated?.onboardingPercentage,
        onboardingStepsCompleted: updated?.onboardingStepsCompleted ?? defaultSteps,
      },
    };
  }
}
