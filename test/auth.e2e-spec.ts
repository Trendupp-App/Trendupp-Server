import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AuthController (E2E)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Match main.ts configuration
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe());

    await app.init();
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
      expect(body.user.email).toBe('google-e2e-user@trendupp.com');
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
        })
        .expect(200);

      const body = res.body as {
        user: {
          email: string;
          role: string;
        };
      };
      expect(body.user.email).toBe('google-brand-user@trendupp.com');
      expect(body.user.role).toBe('brand');
    });

    it('should reject requests with missing idToken (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .send({ role: 'creator' })
        .expect(400);
    });
  });
});
