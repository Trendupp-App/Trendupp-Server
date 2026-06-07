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
});
