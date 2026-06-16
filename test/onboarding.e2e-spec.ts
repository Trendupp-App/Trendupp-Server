/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { OtpRepository } from './../src/domains/auth/repository/otp.repository';
import { ConfigService } from '@nestjs/config';

describe('User Onboarding & Auth Flow (E2E)', () => {
  let app: INestApplication<App>;
  let token: string;
  const testEmail = `creator-${Date.now()}@trendupp.com`;
  const testPassword = 'SecurePassword123';
  const testUsername = `creator_${Date.now()}`;
  let nationalityId: string;
  let stateId: string;
  let nicheId: string;
  let creatorRoleId: string;
  let apiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();

    const configService = app.get(ConfigService);
    apiKey =
      configService.get<string>('onboardingApiKey') ||
      'trendupp-default-onboarding-api-key-for-development-and-testing';
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // --- Auth Flow Tests ---

  it('/api/v1/users/onboarding/roles (GET) - Reject Request with Missing or Invalid API Key', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/onboarding/roles').expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/onboarding/roles')
      .set('x-api-key', 'invalid-key')
      .expect(401);
  });

  it('/api/v1/users/onboarding/roles (GET) - Retrieve only public roles when publicOnly=true', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/onboarding/roles?publicOnly=true')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res: Response): void => {
        const list = res.body as any[];
        expect(list.length).toBe(2);
        const names = list.map((r: { name: string }): string => r.name);
        expect(names).toContain('creator');
        expect(names).toContain('brand');
        expect(names).not.toContain('admin');
      });
  });

  it('/api/v1/users/onboarding/roles (GET) - Retrieve Roles', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/onboarding/roles')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res: Response): void => {
        const list = res.body as any[];
        expect(list.length).toBeGreaterThan(0);
        const creatorRole = list.find((r) => r.name === 'creator');
        expect(creatorRole).toBeDefined();
        creatorRoleId = creatorRole.id as string;
      });
  });

  it('/api/v1/auth/signup (POST) - Register Creator', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'End2End',
        lastName: 'Tester',
        role: creatorRoleId,
        acceptedTerms: true,
      })
      .expect(201)
      .expect((res: Response): void => {
        const body = res.body as Record<string, any>;
        expect(body.message).toContain('Signup successful');
        expect(body.user.email).toBe(testEmail);
      });
  });

  it('/api/v1/auth/otp/verify (POST) - Verify Email & Get JWT', async () => {
    // Query database directly to get the generated code
    const otpRepo = app.get<OtpRepository>(OtpRepository);
    const otpRecord = await (otpRepo as any).otpModel.findOne({
      where: { email: testEmail, type: 'registration' },
      order: [['createdAt', 'DESC']],
    });

    expect(otpRecord).toBeDefined();
    const code = otpRecord.code as string;

    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({
        email: testEmail,
        code,
      })
      .expect(200)
      .expect((res: Response): void => {
        const body = res.body as Record<string, any>;
        expect(body.accessToken).toBeDefined();
        token = body.accessToken as string;
        expect(body.user.isEmailVerified).toBe(true);
      });
  });

  // --- Onboarding Metadata Lookup Tests ---

  it('/api/v1/users/onboarding/nationalities (GET) - Retrieve Countries', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/onboarding/nationalities')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res: Response): void => {
        const list = res.body as any[];
        expect(list.length).toBeGreaterThan(0);
        nationalityId = list[0].id as string;
      });
  });

  it('/api/v1/users/onboarding/nationalities/:id/states (GET) - Retrieve States', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/users/onboarding/nationalities/${nationalityId}/states`)
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res: Response): void => {
        const list = res.body as any[];
        expect(list.length).toBeGreaterThan(0);
        stateId = list[0].id as string;
      });
  });

  it('/api/v1/users/onboarding/niches (GET) - Retrieve Niches', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/onboarding/niches')
      .set('x-api-key', apiKey)
      .expect(200)
      .expect((res: Response): void => {
        const list = res.body as any[];
        expect(list.length).toBeGreaterThan(0);
        nicheId = list[0].id as string;
      });
  });

  // --- Onboarding Step-by-Step Profile Completeness Tests ---

  it('/api/v1/users/onboarding/profile (PATCH) - Step 1: Profile Details (40% complete)', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/users/onboarding/profile')
      .set('Authorization', `Bearer ${token}`)
      .set('x-api-key', apiKey)
      .send({
        username: testUsername,
        nationalityId,
        countryId: nationalityId,
        stateId,
        bio: 'Automated E2E Bio description',
      })
      .expect(200)
      .expect((res: Response): void => {
        const body = res.body as Record<string, any>;
        expect(body.user.onboardingPercentage).toBe(40);
        expect(body.user.username).toBe(testUsername);
        expect(body.user.firstName).toBe('End2End');
        expect(body.user.lastName).toBe('Tester');
        expect(body.user.nationality).toBeDefined();
        expect(body.user.nationality.id).toBe(nationalityId);
        expect(body.user.country).toBeDefined();
        expect(body.user.country.id).toBe(nationalityId);
        expect(body.user.state).toBeDefined();
        expect(body.user.state.id).toBe(stateId);
      });
  });

  it('/api/v1/users/onboarding/niches (POST) - Step 2: Choose Niches (60% complete)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/users/onboarding/niches')
      .set('Authorization', `Bearer ${token}`)
      .set('x-api-key', apiKey)
      .send({
        nicheIds: [nicheId],
      })
      .expect(200)
      .expect((res: Response): void => {
        const body = res.body as Record<string, any>;
        expect(body.user.onboardingPercentage).toBe(60);
      });
  });

  it('/api/v1/users/onboarding/socials (PATCH) - Step 3: Connect Social Accounts (80% complete)', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/users/onboarding/socials')
      .set('Authorization', `Bearer ${token}`)
      .set('x-api-key', apiKey)
      .send({
        instagramUsername: 'trendupp_tester',
        instagramFollowers: 15000, // Micro Creator tier limit
      })
      .expect(200)
      .expect((res: Response): void => {
        const body = res.body as Record<string, any>;
        expect(body.user.onboardingPercentage).toBe(80);
        expect(body.user.assignedTier).toBe('Micro Creator');
      });
  });

  it('/api/v1/users/onboarding/banks (GET) - Retrieve and filter banks by region/country', async () => {
    const resAll = await request(app.getHttpServer())
      .get('/api/v1/users/onboarding/banks')
      .set('x-api-key', apiKey)
      .expect(200);
    expect(resAll.body.length).toBeGreaterThan(0);

    const resAfrica = await request(app.getHttpServer())
      .get('/api/v1/users/onboarding/banks?region=africa')
      .set('x-api-key', apiKey)
      .expect(200);
    const regions = (resAfrica.body as { region: string }[]).map((b) => b.region.toLowerCase());
    expect(regions.every((r: string) => r.includes('africa'))).toBe(true);

    const resNigeria = await request(app.getHttpServer())
      .get('/api/v1/users/onboarding/banks?country=nigeria')
      .set('x-api-key', apiKey)
      .expect(200);
    const countries = (resNigeria.body as { country: string }[]).map((b) =>
      b.country.toLowerCase(),
    );
    expect(countries.every((c: string) => c.includes('nigeria'))).toBe(true);
  });

  it('/api/v1/users/onboarding/payout (PATCH) - Step 4: Submit Payout Details (100% complete)', async () => {
    const bankRes = await request(app.getHttpServer())
      .get('/api/v1/users/onboarding/banks')
      .set('x-api-key', apiKey)
      .expect(200);
    const banks = bankRes.body as any[];
    expect(banks.length).toBeGreaterThan(0);
    const targetBank = banks[0];

    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/onboarding/payout')
      .set('Authorization', `Bearer ${token}`)
      .set('x-api-key', apiKey)
      .send({
        bankId: targetBank.id,
        bankAccountNumber: '0123456789',
        bankAccountName: 'End2End Tester',
      })
      .expect(200);

    const body = res.body as Record<string, any>;
    expect(body.user.onboardingPercentage).toBe(100);
    expect(body.user.bankName).toBe(targetBank.name);
    expect(body.user.bankAccountNumber).toBe('0123456789');
    expect(body.user.bankAccountName).toBe('End2End Tester');
  });
});
