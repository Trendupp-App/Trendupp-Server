import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GoogleAuthService } from './../src/integration/social-apis/google-auth.service';
import { TiktokAuthService } from './../src/integration/social-apis/tiktok-auth.service';
import { UserRepository } from './../src/domains/users/repository/user.repository';

describe('AuthController (E2E)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleAuthService)
      .useValue({
        verifyIdToken: jest.fn().mockImplementation((idToken: string) => {
          if (idToken.startsWith('{')) {
            return Promise.resolve(JSON.parse(idToken) as Record<string, unknown>);
          }
          return Promise.resolve({
            sub: 'mock-google-id-123456789',
            email: 'mock-user@gmail.com',
            email_verified: true,
            name: 'Mock Google User',
            given_name: 'Mock',
            family_name: 'Google User',
          });
        }),
      })
      .overrideProvider(TiktokAuthService)
      .useValue({
        exchangeCodeForToken: jest.fn().mockImplementation((code: string) => {
          return Promise.resolve({
            accessToken: `mock-tiktok-access-token-${code}`,
            openId: `mock-tiktok-open-id-${code}`,
          });
        }),
        getUserProfile: jest.fn().mockImplementation((accessToken: string) => {
          const suffix = accessToken.replace('mock-tiktok-access-token-', '');
          const displayName = suffix.includes('brand') ? 'TikTok Brand User' : 'TikTok User';
          return Promise.resolve({
            openId: `mock-tiktok-open-id-${suffix}`,
            displayName,
            avatarUrl: 'http://avatar.url',
          });
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Match main.ts configuration
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    // Clean up test users that might exist from previous E2E test runs (including soft-deleted ones)
    const userRepo = app.get(UserRepository);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userModel = (userRepo as any).userModel;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await userModel.destroy({
      where: {
        email: [
          'google-e2e-user@trendupp.com',
          'google-brand-user@trendupp.com',
          'tiktok_mock-tiktok-open-id-e2e-creator-code@trendupp.tiktok',
          'tiktok_mock-tiktok-open-id-e2e-brand-code@trendupp.tiktok',
        ],
      },
      force: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await userModel.destroy({
      where: {
        googleId: ['google-e2e-sub-123', 'google-e2e-sub-brand'],
      },
      force: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await userModel.destroy({
      where: {
        tiktokOpenId: [
          'mock-tiktok-open-id-e2e-creator-code',
          'mock-tiktok-open-id-e2e-brand-code',
        ],
      },
      force: true,
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/auth/otp/send (POST) - Valid Body', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/send')
      .send({ email: 'test@trendupp.com' })
      .expect(200)
      .expect((res: Response): void => {
        const body = res.body as Record<string, unknown>;
        expect(body.message).toBe('OTP code has been sent successfully');
      });
  });

  it('/api/v1/auth/otp/send (POST) - Invalid Email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/send')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('/api/v1/auth/otp/verify (POST) - Correct Flow', async () => {
    // 1. Send OTP
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/send')
      .send({ email: 'verify@trendupp.com' })
      .expect(200);

    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ email: 'verify@trendupp.com', code: '000000' })
      .expect(401);
  });

  describe('/api/v1/auth/google (POST)', () => {
    it('should successfully login/signup a user in mock mode with a valid token payload', async () => {
      const mockPayload = {
        sub: 'google-e2e-sub-123',
        email: 'google-e2e-user@trendupp.com',
        given_name: 'GoogleE2E',
        family_name: 'User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          idToken: JSON.stringify(mockPayload),
          acceptedTerms: true,
          acceptedPromotions: true,
        })
        .expect(200);

      const body = res.body as {
        accessToken: string;
        user: {
          email: string;
          firstName: string;
          lastName: string;
          role: string;
          isEmailVerified: boolean;
          acceptedPromotions: boolean;
        };
      };
      expect(body.accessToken).toBeDefined();
      expect(body.user.email).toBe('google-e2e-user@trendupp.com');
      expect(body.user.acceptedPromotions).toBe(true);
      expect(body.user.firstName).toBe('GoogleE2E');
      expect(body.user.lastName).toBe('User');
      expect(body.user.role).toBe('creator'); // Default role
      expect(body.user.isEmailVerified).toBe(true);
    });

    it('should register a new user under a specific role if provided', async () => {
      const mockPayload = {
        sub: 'google-e2e-sub-brand',
        email: 'google-brand-user@trendupp.com',
        given_name: 'GoogleBrand',
        family_name: 'User',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({
          idToken: JSON.stringify(mockPayload),
          role: 'brand',
          acceptedTerms: true,
        })
        .expect(200);

      const body = res.body as {
        user: {
          email: string;
          role: string;
          acceptedPromotions: boolean;
        };
      };
      expect(body.user.email).toBe('google-brand-user@trendupp.com');
      expect(body.user.role).toBe('brand');
      expect(body.user.acceptedPromotions).toBe(false);
    });

    it('should reject requests with missing idToken (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ role: 'creator' })
        .expect(400);
    });
  });

  describe('/api/v1/auth/tiktok (POST)', () => {
    it('should successfully login/signup a user with a valid auth code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/tiktok')
        .send({
          code: 'e2e-creator-code',
          redirectUri: 'http://localhost:3000/auth/tiktok/callback',
          acceptedTerms: true,
        })
        .expect(200);

      const body = res.body as {
        accessToken: string;
        user: {
          email: string;
          firstName: string;
          lastName: string;
          role: string;
          isEmailVerified: boolean;
        };
      };
      expect(body.accessToken).toBeDefined();
      expect(body.user.email).toBe('tiktok_mock-tiktok-open-id-e2e-creator-code@trendupp.tiktok');
      expect(body.user.firstName).toBe('TikTok');
      expect(body.user.role).toBe('creator');
      expect(body.user.isEmailVerified).toBe(true);
    });

    it('should register a new user under a specific role if provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/tiktok')
        .send({
          code: 'e2e-brand-code',
          redirectUri: 'http://localhost:3000/auth/tiktok/callback',
          role: 'brand',
          acceptedTerms: true,
        })
        .expect(200);

      const body = res.body as {
        user: {
          email: string;
          role: string;
        };
      };
      expect(body.user.email).toBe('tiktok_mock-tiktok-open-id-e2e-brand-code@trendupp.tiktok');
      expect(body.user.role).toBe('brand');
    });

    it('should reject requests with missing code or redirectUri (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/tiktok')
        .send({ redirectUri: 'http://localhost:3000' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/auth/tiktok')
        .send({ code: 'some-code' })
        .expect(400);
    });
  });
});
