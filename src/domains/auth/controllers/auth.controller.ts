import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SendOtpDto } from '../dtos/send-otp.dto';
import { VerifyOtpDto } from '../dtos/verify-otp.dto';
import { SignupDto } from '../dtos/signup.dto';
import { LoginDto } from '../dtos/login.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { GoogleLoginDto } from '../dtos/google-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: THROTTLE_LIMITS.SIGNUP })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully, verification OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT token + user details' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials or email not verified',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('google')
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or signup with Google OAuth token' })
  @ApiResponse({
    status: 200,
    description: 'Login/Signup successful, returns JWT token + user details',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid Google token' })
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto);
  }

  @Post('otp/send')
  @Throttle({ default: THROTTLE_LIMITS.OTP_SEND })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an OTP code to an email address' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    await this.authService.sendOtp(sendOtpDto);
    return { message: 'OTP code has been sent successfully' };
  }

  @Post('otp/verify')
  @Throttle({ default: THROTTLE_LIMITS.OTP_VERIFY })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an OTP code' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('password/forgot')
  @Throttle({ default: THROTTLE_LIMITS.FORGOT_PASSWORD })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate forgot password process by sending an OTP reset code' })
  @ApiResponse({ status: 200, description: 'Password reset code triggered successfully' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('password/reset')
  @Throttle({ default: THROTTLE_LIMITS.RESET_PASSWORD })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset account password using verification OTP code' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid code or payload' })
  @ApiResponse({ status: 401, description: 'Expired or invalid verification OTP' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
