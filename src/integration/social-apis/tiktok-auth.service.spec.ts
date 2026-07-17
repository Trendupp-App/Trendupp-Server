import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TiktokAuthService } from './tiktok-auth.service';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

describe('TiktokAuthService', () => {
  let service: TiktokAuthService;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'tiktok.clientKey') return 'mock-tiktok-client-key';
        if (key === 'tiktok.clientSecret') return 'mock-tiktok-client-secret';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [TiktokAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<TiktokAuthService>(TiktokAuthService);
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
        providers: [TiktokAuthService, { provide: ConfigService, useValue: configMockNoIds }],
      }).compile();

      const serviceNoIds = moduleNoIds.get<TiktokAuthService>(TiktokAuthService);

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
          data: {
            access_token: 'real-access-token',
            open_id: 'real-open-id',
          },
        }),
      });
      global.fetch = mockFetch;

      const result = await service.exchangeCodeForToken(
        'real-code',
        'http://localhost:3000/callback',
      );

      expect(mockFetch).toHaveBeenCalledWith('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: 'client_key=mock-tiktok-client-key&client_secret=mock-tiktok-client-secret&code=real-code&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
      });
      expect(result.accessToken).toBe('real-access-token');
      expect(result.openId).toBe('real-open-id');
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

    it('should fetch user profile from TikTok user info endpoint', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            user: {
              open_id: 'real-open-id-123',
              display_name: 'Real TikTok User',
              avatar_url: 'http://avatar.url',
            },
          },
        }),
      });
      global.fetch = mockFetch;

      const profile = await service.getUserProfile('real-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer real-access-token',
          },
        },
      );
      expect(profile.openId).toBe('real-open-id-123');
      expect(profile.displayName).toBe('Real TikTok User');
      expect(profile.avatarUrl).toBe('http://avatar.url');
    });

    it('should throw error when API returns error structure', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          error: {
            code: 'invalid_token',
            message: 'Access token expired',
          },
        }),
      });
      global.fetch = mockFetch;

      await expect(service.getUserProfile('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
