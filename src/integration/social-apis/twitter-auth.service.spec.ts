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

describe('TwitterAuthService (production with credentials)', () => {
  let service: TwitterAuthService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'env') return 'production';
        return 'real-credential'; // client id/secret present
      }),
    } as unknown as jest.Mocked<ConfigService>;

    // Any network attempt must fail loudly rather than reach the real API.
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('denied'),
    } as Response);

    const module: TestingModule = await Test.createTestingModule({
      providers: [TwitterAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<TwitterAuthService>(TwitterAuthService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('does NOT honor mock-prefixed codes in production — they go to the real API and fail', async () => {
    await expect(
      service.exchangeCodeForToken('mock_forged', 'https://app/cb', 'verifier'),
    ).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('does NOT honor mock-prefixed access tokens in production', async () => {
    await expect(service.getUserStats('mock-twitter-access-token-forged')).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalled();
  });
});
