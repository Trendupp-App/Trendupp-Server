import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminLoginDto } from '../dtos/admin-login.dto';
import { AdminForgotPasswordDto } from '../dtos/admin-forgot-password.dto';
import { AdminVerifyOtpDto } from '../dtos/admin-verify-otp.dto';
import { AdminResetPasswordDto } from '../dtos/admin-reset-password.dto';
import { AdminChangePasswordDto } from '../dtos/admin-change-password.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @ApiOperation({ summary: 'Admin login (registered administrators only)' })
  @ApiResponse({ status: 200, description: 'Admin authentication successful' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid credentials or non-admin account',
  })
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const ipAddress = (req.ip as string) || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    return this.adminAuthService.login(dto, ipAddress, userAgent);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.OTP_SEND })
  @ApiOperation({ summary: 'Request admin password reset code (sends 6-digit OTP)' })
  @ApiResponse({ status: 200, description: 'Password reset code sent and returned in response' })
  async forgotPassword(@Body() dto: AdminForgotPasswordDto, @Req() req: Request) {
    const ipAddress = (req.ip as string) || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    return this.adminAuthService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.OTP_VERIFY })
  @ApiOperation({ summary: 'Verify admin password reset OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verification successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP code' })
  async verifyOtp(@Body() dto: AdminVerifyOtpDto) {
    return this.adminAuthService.verifyOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.OTP_VERIFY })
  @ApiOperation({ summary: 'Reset admin password using email and new password' })
  @ApiResponse({ status: 200, description: 'Password reset completed successfully' })
  async resetPassword(@Body() dto: AdminResetPasswordDto, @Req() req: Request) {
    const ipAddress = (req.ip as string) || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    return this.adminAuthService.resetPassword(dto, ipAddress, userAgent);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent', 'admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change admin password (email, current password, and new password)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: AdminChangePasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminAuthService.changePassword(user.id, dto, ipAddress, userAgent);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent', 'admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated admin profile' })
  @ApiResponse({ status: 200, description: 'Admin profile retrieved successfully' })
  getMe(@CurrentUser() user: User) {
    const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : '');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: roleName,
      displayName: user.role?.displayName || roleName,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
