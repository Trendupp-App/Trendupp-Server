import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { TwitterAuthService } from './twitter-auth.service';

async function buildService(configured: boolean): Promise<TwitterAuthService> {
  const configServiceMock = {
    get: jest.fn().mockReturnValue(configured ? 'real-credential' : undefined),
  } as unknown as jest.Mocked<ConfigService>;

  const module: TestingModule = await Test.createTestingModule({
    providers: [TwitterAuthService, { provide: ConfigService, useValue: configServiceMock }],
  }).compile();

  return module.get<TwitterAuthService>(TwitterAuthService);
}

describe('TwitterAuthService', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('throws ServiceUnavailable when credentials are not configured (no mock mode)', async () => {
    const service = await buildService(false);

    await expect(
      service.exchangeCodeForToken('any-code', 'https://app/cb', 'verifier'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.getUserStats('any-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('exchanges a code against the real X token endpoint', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', refresh_token: 'ref', expires_in: 7200 }),
    } as Response);

    const token = await service.exchangeCodeForToken('real-code', 'https://app/cb', 'verifier');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.twitter.com/2/oauth2/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(token).toEqual({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 7200 });
  });

  it('parses user stats from the real /users/me payload', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'u1',
            username: 'creator',
            public_metrics: { followers_count: 1800 },
            profile_image_url: 'https://img',
          },
        }),
    } as Response);

    const stats = await service.getUserStats('tok');

    expect(stats).toEqual({
      userId: 'u1',
      username: 'creator',
      followerCount: 1800,
      avatarUrl: 'https://img',
    });
  });

  it('rejects when the platform declines the code', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('invalid_grant'),
    } as Response);

    await expect(
      service.exchangeCodeForToken('bad-code', 'https://app/cb', 'verifier'),
    ).rejects.toThrow();
  });
});
