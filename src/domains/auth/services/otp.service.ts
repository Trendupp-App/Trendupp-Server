import { Injectable } from '@nestjs/common';
import { Otp } from '../entities/otp.entity';
import { OtpRepository } from '../repository/otp.repository';

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  async generateOtp(email: string, type: string, expiresMinutes = 10): Promise<Otp> {
    await this.otpRepository.deleteByEmailAndType(email, type);

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + expiresMinutes);

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

  /**
   * Verifies a password-reset OTP without deleting it.
   * Marks the record as `isVerified = true` so that `resetPassword` can
   * confirm the verification step was completed without re-submitting the code.
   */
  async verifyOtpForPasswordReset(email: string, code: string): Promise<boolean> {
    const otp = await this.otpRepository.findByEmailAndCode(email, code);

    if (!otp) return false;
    if (otp.type !== 'password-reset') return false;

    const now = new Date();
    if (now > otp.otpExpiresAt) return false;

    await this.otpRepository.markAsVerified(email, 'password-reset');

    return true;
  }

  /** Returns true if a verified password-reset OTP exists for the email. */
  async hasVerifiedPasswordResetOtp(email: string): Promise<boolean> {
    const otp = await this.otpRepository.findVerifiedByEmailAndType(email, 'password-reset');
    return !!otp;
  }

  /** Deletes the verified password-reset OTP after a successful password reset. */
  async consumeVerifiedPasswordResetOtp(email: string): Promise<void> {
    const otp = await this.otpRepository.findVerifiedByEmailAndType(email, 'password-reset');
    if (otp) {
      await this.otpRepository.deleteById(otp.id);
    }
  }

  async findPendingInviteOtp(email: string, type = 'password-reset'): Promise<Otp | null> {
    return this.otpRepository.findByEmailAndType(email, type);
  }
}
