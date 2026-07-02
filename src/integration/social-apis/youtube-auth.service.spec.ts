import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { YoutubeAuthService } from './youtube-auth.service';

describe('YoutubeAuthService (mock mode)', () => {
  let service: YoutubeAuthService;

  beforeEach(async () => {
    const configServiceMock = {
      get: jest.fn().mockReturnValue(null), // no credentials → mock mode
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [YoutubeAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<YoutubeAuthService>(YoutubeAuthService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('exchanges a code for a mock token', async () => {
    const token = await service.exchangeCodeForToken('mock_abc', 'https://app/cb');
    expect(token.accessToken).toContain('mock-youtube-access-token');
  });

  it('returns mock channel stats with a subscriber count', async () => {
    const stats = await service.getChannelStats('mock-youtube-access-token-1');
    expect(stats.followerCount).toBeGreaterThan(0);
    expect(stats.channelId).toBeTruthy();
    expect(stats.username).toBeTruthy();
  });
});
