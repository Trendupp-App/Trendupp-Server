import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { OtpService } from './otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { SendOtpDto } from '../dtos/send-otp.dto';
import { VerifyOtpDto } from '../dtos/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto): Promise<void> {
    const { email } = sendOtpDto;

    const otpRecord = await this.otpService.generateOtp(email, 'login');

    await this.emailService.sendOtpEmail(email, otpRecord.code);

    this.logger.log(`OTP orchestration complete for ${email}`);
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const { email, code } = verifyOtpDto;

    const isValid = await this.otpService.verifyOtp(email, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    return { message: 'OTP verified successfully' };
  }
}
