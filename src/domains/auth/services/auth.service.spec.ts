/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { UsersService } from '../../users/services/users.service';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from '../../../integration/social-apis/google-auth.service';
import { TiktokAuthService } from '../../../integration/social-apis/tiktok-auth.service';
import { InstagramAuthService } from '../../../integration/social-apis/instagram-auth.service';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let otpServiceMock: jest.Mocked<OtpService>;
  let emailServiceMock: jest.Mocked<EmailService>;
  let usersServiceMock: jest.Mocked<UsersService>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let googleAuthServiceMock: jest.Mocked<GoogleAuthService>;
  let tiktokAuthServiceMock: jest.Mocked<TiktokAuthService>;
  let instagramAuthServiceMock: jest.Mocked<InstagramAuthService>;

  beforeEach(async () => {
    otpServiceMock = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
    } as unknown as jest.Mocked<OtpService>;

    emailServiceMock = {
      sendOtpEmail: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    usersServiceMock = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findOneWithNiches: jest.fn(),
      update: jest.fn(),
      findByUsername: jest.fn(),
      findRoleByName: jest.fn(),
      findRoleById: jest.fn(),
      findByGoogleId: jest.fn(),
      findByTiktokOpenId: jest.fn(),
      findByInstagramOpenId: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'jwt.secret') return 'test-secret';
        if (key === 'jwt.expiresIn') return '1h';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    googleAuthServiceMock = {
      verifyIdToken: jest.fn(),
    } as unknown as jest.Mocked<GoogleAuthService>;

    tiktokAuthServiceMock = {
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as unknown as jest.Mocked<TiktokAuthService>;

    instagramAuthServiceMock = {
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as unknown as jest.Mocked<InstagramAuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: GoogleAuthService, useValue: googleAuthServiceMock },
        { provide: TiktokAuthService, useValue: tiktokAuthServiceMock },
        { provide: InstagramAuthService, useValue: instagramAuthServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('sendOtp', () => {
    it('should generate an OTP and send an email', async () => {
      const dto = { email: 'test@example.com' };
      otpServiceMock.generateOtp.mockResolvedValue({ code: '123456' } as any);

      await service.sendOtp(dto);

      expect(otpServiceMock.generateOtp).toHaveBeenCalledWith(dto.email, 'login');
      expect(emailServiceMock.sendOtpEmail).toHaveBeenCalledWith(dto.email, '123456');
    });
  });

  describe('signup', () => {
    it('should throw ConflictException if user already exists', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      };
      usersServiceMock.findByEmail.mockResolvedValue({ id: 'u1' } as any);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        role: 'invalid-role',
      };
      usersServiceMock.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersServiceMock.findRoleByName.mockResolvedValue(null);

      await expect(service.signup(dto)).rejects.toThrow(NotFoundException);
    });

    it('should hash password and create user', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      };
      usersServiceMock.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersServiceMock.findRoleByName.mockResolvedValue({
        id: 'role-uuid',
        name: 'creator',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'u-new',
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: 'role-uuid',
        isEmailVerified: false,
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u-new',
        onboardingPercentage: 20,
      } as any);
      otpServiceMock.generateOtp.mockResolvedValue({ code: '654321' } as any);

      const result = await service.signup(dto);

      expect(usersServiceMock.create).toHaveBeenCalledWith({
        email: dto.email,
        password: 'hashedPassword',
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: undefined,
        roleId: 'role-uuid',
        isEmailVerified: false,
      });
      expect(otpServiceMock.generateOtp).toHaveBeenCalledWith(dto.email, 'registration');
      expect(emailServiceMock.sendOtpEmail).toHaveBeenCalledWith(dto.email, '654321');
      expect(result.user.id).toBe('u-new');
      expect(result.user.role).toBe('creator');
    });

    it('should hash password and create user when role is a valid UUID', async () => {
      const dto = {
        email: 'uuid-role@example.com',
        password: 'password',
        firstName: 'UUID',
        lastName: 'Tester',
        role: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
      };
      usersServiceMock.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      usersServiceMock.findRoleById.mockResolvedValue({
        id: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
        name: 'creator',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'u-new-uuid',
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
        isEmailVerified: false,
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u-new-uuid',
        onboardingPercentage: 20,
      } as any);
      otpServiceMock.generateOtp.mockResolvedValue({ code: '111111' } as any);

      const result = await service.signup(dto);

      expect(usersServiceMock.findRoleById).toHaveBeenCalledWith(
        '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
      );
      expect(usersServiceMock.create).toHaveBeenCalledWith({
        email: dto.email,
        password: 'hashedPassword',
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: undefined,
        roleId: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
        isEmailVerified: false,
      });
      expect(result.user.role).toBe('creator');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password check fails', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        password: 'hashedPassword',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        password: 'hashedPassword',
        isEmailVerified: false,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      otpServiceMock.generateOtp.mockResolvedValue({ code: '111111' } as any);

      await expect(
        service.login({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(otpServiceMock.generateOtp).toHaveBeenCalledWith('test@example.com', 'registration');
    });

    it('should return token on successful login', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        password: 'hashedPassword',
        isEmailVerified: true,
        firstName: 'Test',
        lastName: 'User',
        role: 'creator',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u1',
        onboardingPercentage: 20,
      } as any);

      const result = await service.login({ email: 'test@example.com', password: 'password' });

      expect(result.accessToken).toBeDefined();
      expect(result.user.id).toBe('u1');
    });
  });

  describe('verifyOtp', () => {
    it('should mark email verified and return access token', async () => {
      const dto = { email: 'test@example.com', code: '123456' };
      otpServiceMock.verifyOtp.mockResolvedValue(true);
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        isEmailVerified: false,
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'u1',
        onboardingPercentage: 20,
      } as any);

      const result = await service.verifyOtp(dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', { isEmailVerified: true });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('forgotPassword', () => {
    it('should return trigger message even if user does not exist', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'unknown@example.com' });

      expect(result.message).toContain('sent');
      expect(otpServiceMock.generateOtp).not.toHaveBeenCalled();
    });

    it('should trigger password reset OTP if user exists', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
      } as any);
      otpServiceMock.generateOtp.mockResolvedValue({ code: '333333' } as any);

      const result = await service.forgotPassword({ email: 'test@example.com' });

      expect(otpServiceMock.generateOtp).toHaveBeenCalledWith('test@example.com', 'password-reset');
      expect(emailServiceMock.sendOtpEmail).toHaveBeenCalledWith('test@example.com', '333333');
      expect(result.message).toContain('sent');
    });
  });

  describe('resetPassword', () => {
    it('should throw NotFoundException if user is missing', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: 'unknown@example.com', code: '123456', newPassword: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if OTP code check fails', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
      } as any);
      otpServiceMock.verifyOtp.mockResolvedValue(false);

      await expect(
        service.resetPassword({ email: 'test@example.com', code: 'wrong', newPassword: 'new' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password on successful OTP match', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
      } as any);
      otpServiceMock.verifyOtp.mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedNewPassword');

      const result = await service.resetPassword({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'newPassword123',
      });

      expect(usersServiceMock.update).toHaveBeenCalledWith('u1', { password: 'hashedNewPassword' });
      expect(result.message).toContain('successfully');
    });
  });

  describe('googleLogin', () => {
    it('should verify google token and link googleId to existing user if email matches', async () => {
      const dto = { idToken: 'valid-google-token' };
      const mockPayload = {
        sub: 'google-sub-123',
        email: 'existing@example.com',
        given_name: 'John',
        family_name: 'Doe',
        name: 'John Doe',
      };

      googleAuthServiceMock.verifyIdToken.mockResolvedValue(mockPayload as any);
      usersServiceMock.findByGoogleId.mockResolvedValue(null);
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'user-existing-id',
        email: 'existing@example.com',
        isEmailVerified: false,
      } as any);

      usersServiceMock.update.mockResolvedValue({} as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-existing-id',
        email: 'existing@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-existing-id',
        onboardingPercentage: 20,
      } as any);

      const result = await service.googleLogin(dto);

      expect(googleAuthServiceMock.verifyIdToken).toHaveBeenCalledWith('valid-google-token');
      expect(usersServiceMock.findByGoogleId).toHaveBeenCalledWith('google-sub-123');
      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('existing@example.com');
      expect(usersServiceMock.update).toHaveBeenCalledWith('user-existing-id', {
        googleId: 'google-sub-123',
        isEmailVerified: true,
      });
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('existing@example.com');
      expect(result.user.isEmailVerified).toBe(true);
    });

    it('should create a new user when neither googleId nor email exists in database', async () => {
      const dto = { idToken: 'new-google-token', role: 'brand' };
      const mockPayload = {
        sub: 'google-sub-456',
        email: 'new-user@example.com',
        given_name: 'Jane',
        family_name: 'Doe',
        name: 'Jane Doe',
      };

      googleAuthServiceMock.verifyIdToken.mockResolvedValue(mockPayload as any);
      usersServiceMock.findByGoogleId.mockResolvedValue(null);
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.findRoleByName.mockResolvedValue({
        id: 'brand-role-uuid',
        name: 'brand',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'user-new-id',
        email: 'new-user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        googleId: 'google-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-new-id',
        email: 'new-user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        googleId: 'google-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-new-id',
        onboardingPercentage: 20,
      } as any);

      const result = await service.googleLogin(dto);

      expect(usersServiceMock.create).toHaveBeenCalledWith({
        email: 'new-user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        googleId: 'google-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
      });
      expect(result.user.role).toBe('brand');
    });

    it('should login directly if user is already linked with googleId', async () => {
      const dto = { idToken: 'linked-token' };
      const mockPayload = {
        sub: 'google-sub-789',
        email: 'linked@example.com',
        given_name: 'Bob',
        family_name: 'Smith',
      };

      googleAuthServiceMock.verifyIdToken.mockResolvedValue(mockPayload as any);
      usersServiceMock.findByGoogleId.mockResolvedValue({
        id: 'user-linked-id',
        email: 'linked@example.com',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-linked-id',
        onboardingPercentage: 40,
      } as any);

      const result = await service.googleLogin(dto);

      expect(usersServiceMock.findByEmail).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-linked-id');
      expect(result.user.onboardingPercentage).toBe(40);
    });
  });

  describe('tiktokLogin', () => {
    it('should create a new user when tiktokOpenId does not exist in database', async () => {
      const dto = {
        code: 'mock-code',
        redirectUri: 'http://localhost:3000/callback',
        role: 'brand',
      };
      tiktokAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-123',
        openId: 'tiktok-sub-456',
      });
      tiktokAuthServiceMock.getUserProfile.mockResolvedValue({
        openId: 'tiktok-sub-456',
        displayName: 'Jane Doe',
        avatarUrl: 'http://avatar.url',
      });
      usersServiceMock.findByTiktokOpenId.mockResolvedValue(null);
      usersServiceMock.findRoleByName.mockResolvedValue({
        id: 'brand-role-uuid',
        name: 'brand',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'user-new-id',
        email: 'tiktok_tiktok-sub-456@trendupp.tiktok',
        firstName: 'Jane',
        lastName: 'Doe',
        tiktokOpenId: 'tiktok-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-new-id',
        email: 'tiktok_tiktok-sub-456@trendupp.tiktok',
        firstName: 'Jane',
        lastName: 'Doe',
        tiktokOpenId: 'tiktok-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-new-id',
        onboardingPercentage: 20,
      } as any);

      const result = await service.tiktokLogin(dto);

      expect(tiktokAuthServiceMock.exchangeCodeForToken).toHaveBeenCalledWith(
        'mock-code',
        'http://localhost:3000/callback',
        undefined,
      );
      expect(tiktokAuthServiceMock.getUserProfile).toHaveBeenCalledWith('mock-token-123');
      expect(usersServiceMock.create).toHaveBeenCalledWith({
        email: 'tiktok_tiktok-sub-456@trendupp.tiktok',
        firstName: 'Jane',
        lastName: 'Doe',
        tiktokOpenId: 'tiktok-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
      });
      expect(result.user.role).toBe('brand');
    });

    it('should pass codeVerifier to exchangeCodeForToken if provided in DTO', async () => {
      const dto = {
        code: 'mock-code',
        redirectUri: 'http://localhost:3000/callback',
        role: 'brand',
        codeVerifier: 'mock-verifier-123',
      };
      tiktokAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-123',
        openId: 'tiktok-sub-456',
      });
      tiktokAuthServiceMock.getUserProfile.mockResolvedValue({
        openId: 'tiktok-sub-456',
        displayName: 'Jane Doe',
      });
      usersServiceMock.findByTiktokOpenId.mockResolvedValue(null);
      usersServiceMock.findRoleByName.mockResolvedValue({
        id: 'brand-role-uuid',
        name: 'brand',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'user-new-id',
        email: 'tiktok_tiktok-sub-456@trendupp.tiktok',
        firstName: 'Jane',
        lastName: 'Doe',
        tiktokOpenId: 'tiktok-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-new-id',
        email: 'tiktok_tiktok-sub-456@trendupp.tiktok',
        firstName: 'Jane',
        lastName: 'Doe',
        tiktokOpenId: 'tiktok-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-new-id',
        onboardingPercentage: 20,
      } as any);

      await service.tiktokLogin(dto);

      expect(tiktokAuthServiceMock.exchangeCodeForToken).toHaveBeenCalledWith(
        'mock-code',
        'http://localhost:3000/callback',
        'mock-verifier-123',
      );
    });

    it('should login directly if user is already linked with tiktokOpenId', async () => {
      const dto = { code: 'linked-code', redirectUri: 'http://localhost:3000/callback' };
      tiktokAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-789',
        openId: 'tiktok-sub-789',
      });
      tiktokAuthServiceMock.getUserProfile.mockResolvedValue({
        openId: 'tiktok-sub-789',
        displayName: 'Bob Smith',
      });
      usersServiceMock.findByTiktokOpenId.mockResolvedValue({
        id: 'user-linked-id',
        email: 'tiktok_tiktok-sub-789@trendupp.tiktok',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-linked-id',
        onboardingPercentage: 40,
      } as any);

      const result = await service.tiktokLogin(dto);

      expect(result.user.id).toBe('user-linked-id');
      expect(result.user.onboardingPercentage).toBe(40);
    });
  });

  describe('instagramLogin', () => {
    it('should create a new user when instagramOpenId does not exist in database', async () => {
      const dto = {
        code: 'mock-code',
        redirectUri: 'http://localhost:3000/callback',
        role: 'brand',
      };
      instagramAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-123',
        userId: 'instagram-sub-456',
      });
      instagramAuthServiceMock.getUserProfile.mockResolvedValue({
        id: 'instagram-sub-456',
        username: 'jane_insta',
      });
      usersServiceMock.findByInstagramOpenId.mockResolvedValue(null);
      usersServiceMock.findRoleByName.mockResolvedValue({
        id: 'brand-role-uuid',
        name: 'brand',
      } as any);
      usersServiceMock.create.mockResolvedValue({
        id: 'user-new-id',
        email: 'instagram_instagram-sub-456@trendupp.instagram',
        firstName: 'jane_insta',
        lastName: '',
        instagramOpenId: 'instagram-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-new-id',
        email: 'instagram_instagram-sub-456@trendupp.instagram',
        firstName: 'jane_insta',
        lastName: '',
        instagramOpenId: 'instagram-sub-456',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
        role: { name: 'brand' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-new-id',
        onboardingPercentage: 20,
      } as any);

      const result = await service.instagramLogin(dto);

      expect(instagramAuthServiceMock.exchangeCodeForToken).toHaveBeenCalledWith(
        'mock-code',
        'http://localhost:3000/callback',
      );
      expect(instagramAuthServiceMock.getUserProfile).toHaveBeenCalledWith('mock-token-123');
      expect(usersServiceMock.create).toHaveBeenCalledWith({
        email: 'instagram_instagram-sub-456@trendupp.instagram',
        firstName: 'jane_insta',
        lastName: '',
        instagramOpenId: 'instagram-sub-456',
        instagramUsername: 'jane_insta',
        roleId: 'brand-role-uuid',
        isEmailVerified: true,
      });
      expect(result.user.role).toBe('brand');
    });

    it('should login directly if user is already linked with instagramOpenId', async () => {
      const dto = { code: 'linked-code', redirectUri: 'http://localhost:3000/callback' };
      instagramAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-789',
        userId: 'instagram-sub-789',
      });
      instagramAuthServiceMock.getUserProfile.mockResolvedValue({
        id: 'instagram-sub-789',
        username: 'bob_smith',
      });
      usersServiceMock.findByInstagramOpenId.mockResolvedValue({
        id: 'user-linked-id',
        email: 'instagram_instagram-sub-789@trendupp.instagram',
        instagramUsername: 'bob_smith',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-linked-id',
        onboardingPercentage: 40,
      } as any);

      const result = await service.instagramLogin(dto);

      expect(result.user.id).toBe('user-linked-id');
      expect(result.user.onboardingPercentage).toBe(40);
    });

    it('should update instagramUsername if the username has changed on Instagram', async () => {
      const dto = { code: 'linked-code', redirectUri: 'http://localhost:3000/callback' };
      instagramAuthServiceMock.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'mock-token-789',
        userId: 'instagram-sub-789',
      });
      instagramAuthServiceMock.getUserProfile.mockResolvedValue({
        id: 'instagram-sub-789',
        username: 'new_handle',
      });
      usersServiceMock.findByInstagramOpenId.mockResolvedValue({
        id: 'user-linked-id',
        email: 'instagram_instagram-sub-789@trendupp.instagram',
        instagramUsername: 'old_handle',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.update.mockResolvedValue({} as any);
      usersServiceMock.findOne.mockResolvedValue({
        id: 'user-linked-id',
        email: 'instagram_instagram-sub-789@trendupp.instagram',
        instagramUsername: 'new_handle',
        isEmailVerified: true,
        role: { name: 'creator' },
      } as any);
      usersServiceMock.findOneWithNiches.mockResolvedValue({
        id: 'user-linked-id',
        onboardingPercentage: 40,
      } as any);

      const result = await service.instagramLogin(dto);

      expect(usersServiceMock.update).toHaveBeenCalledWith('user-linked-id', {
        instagramUsername: 'new_handle',
      });
      expect(result.user.id).toBe('user-linked-id');
    });
  });
});
