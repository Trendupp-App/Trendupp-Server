import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TwitterAuthService } from './twitter-auth.service';

describe('TwitterAuthService (mock mode)', () => {
  let service: TwitterAuthService;

  beforeEach(async () => {
    const configServiceMock = {
      get: jest.fn().mockReturnValue(null), // no credentials → mock mode
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [TwitterAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<TwitterAuthService>(TwitterAuthService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('exchanges a code for a mock token', async () => {
    const token = await service.exchangeCodeForToken('mock_abc', 'https://app/cb', 'verifier');
    expect(token.accessToken).toContain('mock-twitter-access-token');
  });

  it('returns mock user stats with a follower count', async () => {
    const stats = await service.getUserStats('mock-twitter-access-token-1');
    expect(stats.followerCount).toBeGreaterThan(0);
    expect(stats.userId).toBeTruthy();
    expect(stats.username).toBeTruthy();
  });
});
