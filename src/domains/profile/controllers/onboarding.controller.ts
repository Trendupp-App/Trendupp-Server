import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { S3Service } from '../../../integration/s3/s3.service';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { OnboardingService } from '../services/onboarding.service';
import { ProfileService } from '../services/profile.service';
import { UsersService } from '../../users/services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { UpdateProfileDto } from '../../users/dtos/update-profile.dto';
import { SetNichesDto } from '../../users/dtos/set-niches.dto';
import { SetIndustriesDto } from '../../users/dtos/set-industries.dto';
import { UpdateBrandRepresentativeDto } from '../../users/dtos/update-brand-representative.dto';
import { UpdateSocialsDto } from '../../users/dtos/update-socials.dto';
import { UpdatePayoutDto } from '../../users/dtos/update-payout.dto';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';

@ApiTags('onboarding')
@ApiSecurity('onboarding-key')
@Controller('users/onboarding')
@UseGuards(ApiKeyGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly usersService: UsersService,
    private readonly profileService: ProfileService,
    private readonly s3Service: S3Service,
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
    return this.onboardingService.getAllNationalities();
  }

  @Get('countries/:countryId/states')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get states belonging to a specific country' })
  @ApiResponse({ status: 200, description: 'List of states retrieved' })
  async getStatesByCountry(@Param('countryId') countryId: string) {
    return this.onboardingService.getStatesByNationality(countryId);
  }

  @Get('countries/:countryId/states/:stateId/cities')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get cities belonging to a specific country and state' })
  @ApiResponse({ status: 200, description: 'List of cities retrieved' })
  async getCitiesByCountryAndState(
    @Param('countryId') countryId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.onboardingService.getCitiesByCountryAndState(countryId, stateId);
  }

  @Get('nationalities/:nationalityId/states/:stateId/cities')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get cities belonging to a specific nationality and state' })
  @ApiResponse({ status: 200, description: 'List of cities retrieved' })
  async getCitiesByNationalityAndState(
    @Param('nationalityId') nationalityId: string,
    @Param('stateId') stateId: string,
  ) {
    return this.onboardingService.getCitiesByCountryAndState(nationalityId, stateId);
  }

  @Get('banks')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Get all banks, optionally filtered by region, country, or search term',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    type: String,
    description: 'Filter banks by continent/region (e.g. Africa)',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    type: String,
    description: 'Filter banks by country name (e.g. Nigeria)',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search banks by name' })
  @ApiResponse({ status: 200, description: 'List of banks retrieved' })
  async getBanks(
    @Query('region') region?: string,
    @Query('country') country?: string,
    @Query('search') search?: string,
  ) {
    return this.onboardingService.getBanks({ region, country, search });
  }

  // ─── Onboarding Steps ──────────────────────────────────────────────────────

  @Patch('profile')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 1: Build user profile (Creators and Brands)',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
            message: 'File is too large. Max allowed size is 5MB.',
          }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp)$/i }),
        ],
        fileIsRequired: false,
      }),
    )
    avatar?: Express.Multer.File,
  ) {
    const updates: Partial<User> = {
      countryId: dto.countryId,
      stateId: dto.stateId,
    };

    if (dto.bio !== undefined) updates.bio = dto.bio;
    if (dto.username !== undefined) updates.username = dto.username;
    if (dto.brandName !== undefined) updates.username = dto.brandName; // Map brandName to username
    if (dto.nationalityId !== undefined) updates.nationalityId = dto.nationalityId;
    if (dto.city !== undefined) updates.city = dto.city;
    if (dto.websiteUrl !== undefined) updates.websiteUrl = dto.websiteUrl;
    if (dto.monthlyBudget !== undefined) updates.monthlyBudget = dto.monthlyBudget;

    if (avatar) {
      const avatarUrl = await this.s3Service.uploadFile(avatar, 'avatars');
      updates.avatarUrl = avatarUrl;
    }

    await this.usersService.update(user.id, updates);

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Profile details updated successfully',
      user: updated,
    };
  }

  @Get('industries')
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({ summary: 'Get all sorted industries for onboarding selection (Brands)' })
  @ApiResponse({ status: 200, description: 'List of industries retrieved' })
  async getIndustries() {
    return this.onboardingService.getAllIndustries();
  }

  @Post('industries')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Save selected industries (Brands)' })
  @ApiResponse({ status: 200, description: 'Brand industries saved successfully' })
  async setIndustries(@CurrentUser() user: User, @Body() dto: SetIndustriesDto) {
    const updated = await this.onboardingService.setUserIndustries(user.id, dto.industryIds);
    return {
      message: 'Industries associated successfully',
      user: updated,
    };
  }

  @Patch('representative')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Save representative details (Brands)' })
  @ApiResponse({ status: 200, description: 'Brand representative saved successfully' })
  async updateRepresentative(@CurrentUser() user: User, @Body() dto: UpdateBrandRepresentativeDto) {
    const updated = await this.onboardingService.setUserRepresentative(user.id, dto);
    return {
      message: 'Representative details updated successfully',
      user: updated,
    };
  }

  @Post('niches')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Save selected niches (Creators)' })
  @ApiResponse({ status: 200, description: 'User niches saved successfully' })
  async setNiches(@CurrentUser() user: User, @Body() dto: SetNichesDto) {
    await this.usersService.setUserNiches(user.id, dto.nicheIds);

    const updated = await this.usersService.findOneWithNiches(user.id);
    return {
      message: 'Niches associated successfully',
      user: updated,
    };
  }

  @Patch('socials')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Connect social profiles (Creators and Brands)' })
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
      user: updated,
    };
  }

  @Patch('payout')
  @Throttle({ default: THROTTLE_LIMITS.ONBOARDING_STEP })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 4: Save payout details (Creators)',
  })
  @ApiResponse({ status: 200, description: 'Payout details saved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePayout(@CurrentUser() user: User, @Body() dto: UpdatePayoutDto) {
    const updated = await this.profileService.updatePayout(user.id, dto);
    return {
      message: 'Payout details saved successfully',
      user: updated,
    };
  }
}
