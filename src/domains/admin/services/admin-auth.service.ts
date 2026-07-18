import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../../users/services/users.service';
import { OtpService } from '../../auth/services/otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { AuditLogService } from './audit-log.service';
import { AdminLoginDto } from '../dtos/admin-login.dto';
import { AdminForgotPasswordDto } from '../dtos/admin-forgot-password.dto';
import { AdminVerifyOtpDto } from '../dtos/admin-verify-otp.dto';
import { AdminResetPasswordDto } from '../dtos/admin-reset-password.dto';
import { AdminChangePasswordDto } from '../dtos/admin-change-password.dto';
import { User } from '../../users/entities/user.entity';

export const ADMIN_ROLES = new Set([
  'owner',
  'super_admin',
  'finance_admin',
  'moderator',
  'support_agent',
  'admin',
]);

export interface AdminAuthResponse {
  accessToken: string;
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    displayName: string;
    isActive: boolean;
  };
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: AdminLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminAuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : '');
    if (!roleName || !ADMIN_ROLES.has(roleName.toLowerCase())) {
      throw new UnauthorizedException('Access denied. Account is not an administrator.');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Your administrator account is suspended or inactive.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user);

    // Record audit log
    await this.auditLogService.log({
      adminId: user.id,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      details: { role: roleName },
    });

    return {
      accessToken: token,
      admin: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: roleName,
        displayName: user.role?.displayName || roleName,
        isActive: user.isActive,
      },
    };
  }

  async forgotPassword(
    dto: AdminForgotPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; code?: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.warn(`Admin password reset requested for non-existent email: ${email}`);
      return { message: 'If the email exists, a password reset OTP code has been sent.' };
    }

    const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : '');
    if (!roleName || !ADMIN_ROLES.has(roleName.toLowerCase())) {
      return { message: 'If the email exists, a password reset OTP code has been sent.' };
    }

    const otpRecord = await this.otpService.generateOtp(email, 'password-reset');
    await this.emailService.sendOtpEmail(email, otpRecord.code);

    await this.auditLogService.log({
      adminId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress,
      userAgent,
    });

    return {
      message: `Password reset OTP code generated: ${otpRecord.code}`,
      code: otpRecord.code,
    };
  }

  async verifyOtp(dto: AdminVerifyOtpDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const isValid = await this.otpService.verifyOtp(email, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification OTP code');
    }
    return { message: 'OTP verification successful.' };
  }

  async resetPassword(
    dto: AdminResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.usersService.update(user.id, { password: hashedPassword });

    await this.auditLogService.log({
      adminId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      ipAddress,
      userAgent,
    });

    return { message: 'Password has been reset successfully. You can now sign in.' };
  }

  async changePassword(
    adminId: string,
    dto: AdminChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      throw new NotFoundException('Admin user not found');
    }

    if (user.id !== adminId && user.email !== email) {
      throw new BadRequestException('Email does not match authenticated user');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.update(user.id, { password: hashedPassword });

    await this.auditLogService.log({
      adminId: user.id,
      action: 'PASSWORD_CHANGED',
      ipAddress,
      userAgent,
    });

    return { message: 'Password changed successfully.' };
  }

  private generateToken(user: User): string {
    const secret =
      this.configService.get<string>('jwt.secret') ||
      'trendupp-default-secret-key-for-development-and-testing';
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '24h';
    return jwt.sign({ id: user.id, email: user.email }, secret, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }
}
