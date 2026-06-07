import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { OtpRepository } from '../repository/otp.repository';
import { Otp } from '../entities/otp.entity';

describe('OtpService', () => {
  let service: OtpService;
  let otpRepositoryMock: jest.Mocked<OtpRepository>;

  beforeEach(async () => {
    otpRepositoryMock = {
      deleteByEmailAndType: jest.fn(),
      create: jest.fn(),
      findByEmailAndCode: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as jest.Mocked<OtpRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpService, { provide: OtpRepository, useValue: otpRepositoryMock }],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateOtp', () => {
    it('should clean up old OTPs, generate a 6-digit code, and create a new record', async () => {
      const email = 'test@example.com';
      const type = 'login';

      otpRepositoryMock.create.mockResolvedValue({ email, code: '123456' } as unknown as Otp);

      const result = await service.generateOtp(email, type);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(otpRepositoryMock.deleteByEmailAndType).toHaveBeenCalledWith(email, type);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(otpRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ email, type }),
      );
      expect(result.code).toHaveLength(6);
    });
  });

  describe('verifyOtp', () => {
    it('should return true and delete the OTP for a valid, non-expired record', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);

      otpRepositoryMock.findByEmailAndCode.mockResolvedValue({
        id: 'otp-id',
        code: '111222',
        otpExpiresAt: futureDate,
      } as unknown as Otp);

      const isValid = await service.verifyOtp('test@example.com', '111222');

      expect(isValid).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(otpRepositoryMock.deleteById).toHaveBeenCalledWith('otp-id');
    });

    it('should return false for an expired OTP', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 5);

      otpRepositoryMock.findByEmailAndCode.mockResolvedValue({
        id: 'otp-id',
        code: '111222',
        otpExpiresAt: pastDate,
      } as unknown as Otp);

      const isValid = await service.verifyOtp('test@example.com', '111222');

      expect(isValid).toBe(false);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(otpRepositoryMock.deleteById).not.toHaveBeenCalled();
    });

    it('should return false when no OTP record is found', async () => {
      otpRepositoryMock.findByEmailAndCode.mockResolvedValue(null);

      const isValid = await service.verifyOtp('test@example.com', '000000');

      expect(isValid).toBe(false);
    });
  });
});
