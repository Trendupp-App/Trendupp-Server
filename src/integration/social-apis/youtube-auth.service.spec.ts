import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { YoutubeAuthService } from './youtube-auth.service';

async function buildService(configured: boolean): Promise<YoutubeAuthService> {
  const configServiceMock = {
    get: jest.fn().mockReturnValue(configured ? 'real-credential' : undefined),
  } as unknown as jest.Mocked<ConfigService>;

  const module: TestingModule = await Test.createTestingModule({
    providers: [YoutubeAuthService, { provide: ConfigService, useValue: configServiceMock }],
  }).compile();

  return module.get<YoutubeAuthService>(YoutubeAuthService);
}

describe('YoutubeAuthService', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('throws ServiceUnavailable when credentials are not configured (no mock mode)', async () => {
    const service = await buildService(false);

    await expect(service.exchangeCodeForToken('any-code', 'https://app/cb')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.getChannelStats('any-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('exchanges a code against the real Google token endpoint', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
    } as Response);

    const token = await service.exchangeCodeForToken('real-code', 'https://app/cb', 'verifier');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(token).toEqual({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 });
  });

  it('parses channel stats from the real Data API payload', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: 'ch1',
              snippet: {
                title: 'My Channel',
                customUrl: '@mychannel',
                thumbnails: { default: { url: 'https://img' } },
              },
              statistics: { subscriberCount: '2300' },
            },
          ],
        }),
    } as Response);

    const stats = await service.getChannelStats('tok');

    expect(stats).toEqual({
      channelId: 'ch1',
      username: '@mychannel',
      followerCount: 2300,
      avatarUrl: 'https://img',
    });
  });

  it('rejects when the Google account has no YouTube channel', async () => {
    const service = await buildService(true);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    } as Response);

    await expect(service.getChannelStats('tok')).rejects.toThrow();
  });
});
