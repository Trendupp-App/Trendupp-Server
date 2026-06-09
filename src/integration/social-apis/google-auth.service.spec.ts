import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let configServiceMock: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'google.clientIdWeb') return 'mock-web-client-id';
        if (key === 'google.clientIdIos') return 'mock-ios-client-id';
        if (key === 'google.clientIdAndroid') return 'mock-android-client-id';
        return null;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleAuthService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyIdToken (mock mode)', () => {
    it('should bypass verification if client IDs are missing and return mock payload', async () => {
      const configMockNoIds = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as jest.Mocked<ConfigService>;

      const moduleNoIds = await Test.createTestingModule({
        providers: [GoogleAuthService, { provide: ConfigService, useValue: configMockNoIds }],
      }).compile();

      const serviceNoIds = moduleNoIds.get<GoogleAuthService>(GoogleAuthService);
      const result = await serviceNoIds.verifyIdToken('any-token-string');

      expect(result.email).toBe('mock-user@gmail.com');
      expect(result.sub).toBe('mock-google-id-123456789');
    });

    it('should parse mock token if it is JSON and client IDs are missing', async () => {
      const configMockNoIds = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as jest.Mocked<ConfigService>;

      const moduleNoIds = await Test.createTestingModule({
        providers: [GoogleAuthService, { provide: ConfigService, useValue: configMockNoIds }],
      }).compile();

      const serviceNoIds = moduleNoIds.get<GoogleAuthService>(GoogleAuthService);
      const customPayload = {
        sub: 'custom-id',
        email: 'custom@example.com',
        given_name: 'Custom',
        family_name: 'User',
      };
      const result = await serviceNoIds.verifyIdToken(JSON.stringify(customPayload));

      expect(result.email).toBe('custom@example.com');
      expect(result.sub).toBe('custom-id');
    });
  });
});
