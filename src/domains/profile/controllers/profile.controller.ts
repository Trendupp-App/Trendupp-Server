import {
  Controller,
  Patch,
  Put,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { ProfileService } from '../services/profile.service';
import { UpdatePersonalInfoDto } from '../dtos/update-personal-info.dto';
import { UpdateNichesDto } from '../dtos/update-niches.dto';
import { UpdateSocialsDto } from '../dtos/update-socials.dto';
import { UpdatePayoutDto } from '../dtos/update-payout.dto';
import { UpdateNotificationSettingsDto } from '../dtos/update-notification-settings.dto';
import { UpdateSecuritySettingsDto } from '../dtos/update-security-settings.dto';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { DeactivateAccountDto } from '../dtos/deactivate-account.dto';

@ApiTags('profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch('personal-info')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit Profile Step 1: Personal Info & Profile Picture' })
  @ApiResponse({ status: 200, description: 'Personal info updated successfully' })
  async updatePersonalInfo(
    @CurrentUser() user: User,
    @Body() dto: UpdatePersonalInfoDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.profileService.updatePersonalInfo(user.id, dto, avatar);
  }

  @Put('niches')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit Profile Step 2: Content Niches' })
  @ApiResponse({ status: 200, description: 'Niches associated successfully' })
  async updateNiches(@CurrentUser() user: User, @Body() dto: UpdateNichesDto) {
    return this.profileService.updateNiches(user.id, dto.nicheIds);
  }

  @Patch('socials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit Profile Step 3: Social Account Connections' })
  @ApiResponse({ status: 200, description: 'Social accounts updated successfully' })
  async updateSocials(@CurrentUser() user: User, @Body() dto: UpdateSocialsDto) {
    return this.profileService.updateSocials(user.id, dto);
  }

  @Patch('payout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit Profile Step 4: Payout Details' })
  @ApiResponse({ status: 200, description: 'Payout details updated successfully' })
  async updatePayout(@CurrentUser() user: User, @Body() dto: UpdatePayoutDto) {
    return this.profileService.updatePayout(user.id, dto);
  }

  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved successfully' })
  async getNotifications(@CurrentUser() user: User): Promise<User['notificationSettings']> {
    return this.profileService.getNotificationSettings(user.id);
  }

  @Patch('notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings updated successfully' })
  async updateNotifications(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<User['notificationSettings']> {
    return this.profileService.updateNotificationSettings(user.id, dto);
  }

  @Get('security')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current security settings' })
  @ApiResponse({ status: 200, description: 'Security settings retrieved successfully' })
  async getSecurity(@CurrentUser() user: User): Promise<User['securitySettings']> {
    return this.profileService.getSecuritySettings(user.id);
  }

  @Patch('security')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update security settings' })
  @ApiResponse({ status: 200, description: 'Security settings updated successfully' })
  async updateSecurity(
    @CurrentUser() user: User,
    @Body() dto: UpdateSecuritySettingsDto,
  ): Promise<User['securitySettings']> {
    return this.profileService.updateSecuritySettings(user.id, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change account password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    await this.profileService.changePassword(user.id, dto);
    return { message: 'Password has been changed successfully' };
  }

  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'Account deactivated successfully' })
  async deactivateAccount(@CurrentUser() user: User, @Body() dto: DeactivateAccountDto) {
    await this.profileService.deactivateAccount(user.id, dto);
    return { message: 'Account has been deactivated successfully' };
  }
}
