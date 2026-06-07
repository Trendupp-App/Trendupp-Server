import { Injectable } from '@nestjs/common';
import { Otp } from '../entities/otp.entity';
import { OtpRepository } from '../repository/otp.repository';

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  async generateOtp(email: string, type: string): Promise<Otp> {
    await this.otpRepository.deleteByEmailAndType(email, type);

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10);

    return this.otpRepository.create({ email, code, type, otpExpiresAt });
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const otp = await this.otpRepository.findByEmailAndCode(email, code);

    if (!otp) return false;

    const now = new Date();
    if (now > otp.otpExpiresAt) return false;

    await this.otpRepository.deleteById(otp.id);

    return true;
  }
}
