import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InstagramAuthService } from './instagram-auth.service';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

describe('InstagramAuthService', () => {
  let service: InstagramAuthService;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'instagram.appId') return 'mock-instagram-app-id';
        if (key === 'instagram.appSecret') return 'mock-instagram-app-secret';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [InstagramAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<InstagramAuthService>(InstagramAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('without credentials (no mock mode)', () => {
    it('throws ServiceUnavailable instead of fabricating identities', async () => {
      const configMockNoIds = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as jest.Mocked<ConfigService>;

      const moduleNoIds = await Test.createTestingModule({
        providers: [InstagramAuthService, { provide: ConfigService, useValue: configMockNoIds }],
      }).compile();

      const serviceNoIds = moduleNoIds.get<InstagramAuthService>(InstagramAuthService);

      await expect(
        serviceNoIds.exchangeCodeForToken('any-code', 'http://localhost:3000'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(serviceNoIds.getUserProfile('any-token')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(serviceNoIds.getFollowerStats('any-token')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('exchangeCodeForToken (real mode)', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should make a successful post exchange request', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'real-access-token',
          user_id: 'real-user-id',
        }),
      });
      global.fetch = mockFetch;

      const result = await service.exchangeCodeForToken(
        'real-code',
        'http://localhost:3000/callback',
      );

      expect(mockFetch).toHaveBeenCalledWith('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: 'client_id=mock-instagram-app-id&client_secret=mock-instagram-app-secret&code=real-code&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
      });
      expect(result.accessToken).toBe('real-access-token');
      expect(result.userId).toBe('real-user-id');
    });

    it('should throw UnauthorizedException on API error', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Invalid code'),
      });
      global.fetch = mockFetch;

      await expect(
        service.exchangeCodeForToken('invalid-code', 'http://localhost:3000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserProfile (real mode)', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch user profile from Instagram graph me endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          user_id: 'real-user-id-123',
          username: 'real_instagram_user',
        }),
      });
      global.fetch = mockFetch;

      const profile = await service.getUserProfile('real-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=real-access-token',
        {
          method: 'GET',
        },
      );
      expect(profile.id).toBe('real-user-id-123');
      expect(profile.username).toBe('real_instagram_user');
    });

    it('should throw error when API call returns not ok', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Invalid Token'),
      });
      global.fetch = mockFetch;

      await expect(service.getUserProfile('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
