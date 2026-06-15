import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GoogleAuthService } from './../src/integration/social-apis/google-auth.service';
import { TiktokAuthService } from './../src/integration/social-apis/tiktok-auth.service';
import { CreatorCategory } from './../src/domains/campaigns/entities/creator-category.entity';
import { Platform } from './../src/domains/campaigns/entities/platform.entity';

describe('CampaignsController (E2E)', () => {
  let app: INestApplication<App>;
  let brandToken: string;
  let microCategoryId: string;
  let instagramPlatformId: string;

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
            sub: 'campaign-e2e-google-sub',
            email: 'campaign-e2e@trendupp.com',
            given_name: 'CampaignE2E',
            family_name: 'User',
          });
        }),
      })
      .overrideProvider(TiktokAuthService)
      .useValue({
        exchangeCodeForToken: jest.fn().mockResolvedValue({
          accessToken: 'mock-token',
          openId: 'mock-open-id',
        }),
        getUserProfile: jest.fn().mockResolvedValue({
          openId: 'mock-open-id',
          displayName: 'TikTok E2E',
          avatarUrl: 'http://avatar.url',
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Fetch seeded category and platform IDs from the database
    const category = await CreatorCategory.findOne({ where: { name: 'Micro' } });
    const platform = await Platform.findOne({ where: { name: 'Instagram' } });
    microCategoryId = category!.id;
    instagramPlatformId = platform!.id;

    // Register a brand user via Google OAuth and capture the token
    const googlePayload = {
      sub: 'campaign-e2e-brand-sub',
      email: 'campaign-brand-e2e@trendupp.com',
      given_name: 'BrandE2E',
      family_name: 'User',
    };

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: JSON.stringify(googlePayload),
        role: 'brand',
      })
      .expect(200);

    const loginBody = loginRes.body as { accessToken: string };
    brandToken = loginBody.accessToken;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─── Validation Tests ────────────────────────────────────────────────────

  it('POST /api/v1/campaigns - should reject unauthenticated requests (401)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .field('title', 'Unauthorized Campaign')
      .field('goal', 'Create Content')
      .field('totalBudget', 1000000)
      .field('paymentPerCreator', '50,000')
      .field('creatorCategoryId', microCategoryId)
      .field('preferredPlatformIds', instagramPlatformId)
      .field('contentType', 'Video')
      .field('duration', 10)
      .expect(401);
  });

  it('POST /api/v1/campaigns - should reject invalid body (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .field('title', 'Missing fields')
      .expect(400);
  });

  it('POST /api/v1/campaigns - should reject invalid goal value (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .field('title', 'Bad Goal Campaign')
      .field('goal', 'Invalid Goal')
      .field('totalBudget', 1000000)
      .field('paymentPerCreator', '50,000')
      .field('creatorCategoryId', microCategoryId)
      .field('preferredPlatformIds', instagramPlatformId)
      .field('contentType', 'Video')
      .field('duration', 10)
      .expect(400);
  });

  // ─── Happy Path: Create & Retrieve ────────────────────────────────────────

  let createdCampaignId: string;

  it('POST /api/v1/campaigns - should create a campaign successfully (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${brandToken}`)
      .field('title', 'Summer Style Collection')
      .field('goal', 'Create Content')
      .field('totalBudget', 3000000)
      .field('paymentPerCreator', '80,000 - 150,000')
      .field('creatorCategoryId', microCategoryId)
      .field('preferredPlatformIds', instagramPlatformId)
      .field('contentType', 'Video')
      .field('duration', 15)
      .field('contentDuration', '30secs - 1min')
      .field('contentGuidelines', 'Show the product in natural light.')
      .attach('coverImage', Buffer.from('mock-file-content'), 'cover.jpg')
      .expect(201);

    const body = res.body as {
      message: string;
      campaign: { id: string; status: string; title: string };
    };
    expect(body.message).toContain('Campaign created successfully');
    expect(body.campaign.title).toBe('Summer Style Collection');
    expect(body.campaign.status).toBe('pending_approval');
    createdCampaignId = body.campaign.id;
  });

  it('GET /api/v1/campaigns - should list all campaigns', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/campaigns').expect(200);

    const body = res.body as Array<{ id: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/campaigns/:id - should retrieve the created campaign with relations', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/campaigns/${createdCampaignId}`)
      .expect(200);

    const body = res.body as {
      id: string;
      title: string;
      brand: { email: string };
      creatorCategory: { name: string };
      preferredPlatforms: Array<{ name: string }>;
      coverImage: string;
    };
    expect(body.id).toBe(createdCampaignId);
    expect(body.title).toBe('Summer Style Collection');
    expect(body.brand).toBeDefined();
    expect(body.brand.email).toBe('campaign-brand-e2e@trendupp.com');
    expect(body.creatorCategory).toBeDefined();
    expect(body.creatorCategory.name).toBe('Micro');
    expect(body.preferredPlatforms).toBeDefined();
    expect(body.preferredPlatforms[0].name).toBe('Instagram');
    expect(body.coverImage).toBeDefined();
  });

  it('GET /api/v1/campaigns/:id - should return 404 for unknown ID', () => {
    return request(app.getHttpServer())
      .get('/api/v1/campaigns/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /api/v1/campaigns/my - should return campaigns for the authenticated brand', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/campaigns/my')
      .set('Authorization', `Bearer ${brandToken}`)
      .expect(200);

    const body = res.body as Array<{ id: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((c) => c.id === createdCampaignId)).toBe(true);
  });

  // ─── Admin Approval ──────────────────────────────────────────────────────

  it('PATCH /api/v1/admin/campaigns/:id/approve - should reject non-admin users (403)', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/admin/campaigns/${createdCampaignId}/approve`)
      .set('Authorization', `Bearer ${brandToken}`)
      .expect(403);
  });
});
