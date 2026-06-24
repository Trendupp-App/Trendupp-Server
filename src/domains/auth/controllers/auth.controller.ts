import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBody,
  ApiSecurity,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { SendOtpDto } from '../dtos/send-otp.dto';
import { VerifyOtpDto } from '../dtos/verify-otp.dto';
import { SignupDto, CreatorSignupDto, BrandSignupDto } from '../dtos/signup.dto';
import { LoginDto } from '../dtos/login.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { GoogleLoginDto } from '../dtos/google-login.dto';
import { TiktokLoginDto } from '../dtos/tiktok-login.dto';
import { InstagramLoginDto } from '../dtos/instagram-login.dto';
import { ApiKeyGuard } from '../guards/api-key.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: THROTTLE_LIMITS.SIGNUP })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account (Creators and Brands)' })
  @ApiExtraModels(CreatorSignupDto, BrandSignupDto)
  @ApiBody({
    description:
      'Registration payload (Toggle between Creator and Brand schemas using the dropdown below)',
    schema: {
      oneOf: [{ $ref: getSchemaPath(CreatorSignupDto) }, { $ref: getSchemaPath(BrandSignupDto) }],
    },
  })
  @ApiResponse({ status: 201, description: 'User registered successfully, verification OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password (Creators and Brands)' })
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
  @ApiOperation({ summary: 'Login or signup with Google OAuth token (Creators and Brands)' })
  @ApiResponse({
    status: 200,
    description: 'Login/Signup successful, returns JWT token + user details',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid Google token' })
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto);
  }

  @Post('tiktok')
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or signup with TikTok authorization code (Creators and Brands)' })
  @ApiResponse({
    status: 200,
    description: 'Login/Signup successful, returns JWT token + user details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid TikTok code or exchange failure',
  })
  async tiktokLogin(@Body() tiktokLoginDto: TiktokLoginDto) {
    return this.authService.tiktokLogin(tiktokLoginDto);
  }

  @Post('instagram')
  @Throttle({ default: THROTTLE_LIMITS.LOGIN })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login or signup with Instagram authorization code (Creators and Brands)',
  })
  @ApiResponse({
    status: 200,
    description: 'Login/Signup successful, returns JWT token + user details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid Instagram code or exchange failure',
  })
  async instagramLogin(@Body() instagramLoginDto: InstagramLoginDto) {
    return this.authService.instagramLogin(instagramLoginDto);
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

  @Get('username/check')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('onboarding-key')
  @Throttle({ default: THROTTLE_LIMITS.USERNAME_CHECK })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if a username/brandName is available or taken' })
  @ApiQuery({
    name: 'username',
    description: 'The username to check',
    example: 'trendsetter_ojima',
  })
  @ApiResponse({ status: 200, description: 'Availability status of the username' })
  @ApiResponse({ status: 400, description: 'Username query parameter is required' })
  async checkUsernameAvailability(@Query('username') username: string) {
    if (!username || username.trim() === '') {
      throw new BadRequestException('username query parameter is required');
    }
    return this.authService.checkUsernameAvailability(username.trim());
  }
}
