import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let otpServiceMock: jest.Mocked<OtpService>;
  let emailServiceMock: jest.Mocked<EmailService>;

  beforeEach(async () => {
    otpServiceMock = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
    } as unknown as jest.Mocked<OtpService>;
    emailServiceMock = {
      sendOtpEmail: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('sendOtp', () => {
    it('should generate an OTP and send an email', async () => {
      const dto = { email: 'test@example.com' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      otpServiceMock.generateOtp.mockResolvedValue({ code: '123456' } as any);

      await service.sendOtp(dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(otpServiceMock.generateOtp).toHaveBeenCalledWith(dto.email, 'login');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(emailServiceMock.sendOtpEmail).toHaveBeenCalledWith(dto.email, '123456');
    });
  });

  describe('verifyOtp', () => {
    it('should return success message if OTP is valid', async () => {
      const dto = { email: 'test@example.com', code: '123456' };

      otpServiceMock.verifyOtp.mockResolvedValue(true);

      const result = await service.verifyOtp(dto);

      expect(result.message).toBe('OTP verified successfully');
    });

    it('should throw UnauthorizedException if OTP is invalid', async () => {
      const dto = { email: 'test@example.com', code: '123456' };

      otpServiceMock.verifyOtp.mockResolvedValue(false);

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
