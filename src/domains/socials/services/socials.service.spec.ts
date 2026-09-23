/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SocialsService } from './socials.service';
import { SocialConnectionRepository } from '../repository/social-connection.repository';
import { SocialPlatformSettingRepository } from '../repository/social-platform-setting.repository';
import { SocialVerificationService } from './social-verification.service';
import { UsersService } from '../../users/services/users.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SocialConnection } from '../entities/social-connection.entity';
import { SocialPlatform } from '../constants/social-platforms';

const conn = (over: Partial<SocialConnection>): SocialConnection =>
  ({
    platform: SocialPlatform.TIKTOK,
    username: 'creator',
    followerCount: 0,
    isVerified: true,
    avatarUrl: null,
    accessToken: null,
    createdAt: new Date('2026-06-25T00:00:00Z'),
    update: jest.fn(),
    ...over,
  }) as unknown as SocialConnection;

describe('SocialsService', () => {
  let service: SocialsService;
  let repo: jest.Mocked<SocialConnectionRepository>;
  let settingsRepo: jest.Mocked<SocialPlatformSettingRepository>;
  let verification: jest.Mocked<SocialVerificationService>;
  let users: jest.Mocked<UsersService>;
  let notifications: jest.Mocked<NotificationsService>;

  const userId = 'user-1';

  beforeEach(async () => {
    repo = {
      findByUser: jest.fn().mockResolvedValue([]),
      findByUserAndPlatform: jest.fn(),
      findByPlatformAccount: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(conn({})),
      removeByUserAndPlatform: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<SocialConnectionRepository>;

    settingsRepo = {
      // Seed values from the social_platform_settings migration
      getMinFollowers: jest.fn().mockResolvedValue({
        instagram: 1000,
        tiktok: 1000,
        youtube: 500,
        twitter: 500,
        facebook: 1000,
      }),
      getEnabled: jest.fn().mockResolvedValue({
        instagram: true,
        tiktok: true,
        youtube: true,
        twitter: true,
        facebook: true,
      }),
    } as unknown as jest.Mocked<SocialPlatformSettingRepository>;

    verification = {
      verify: jest.fn(),
      refreshStats: jest.fn(),
    } as unknown as jest.Mocked<SocialVerificationService>;

    users = {
      update: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<UsersService>;

    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialsService,
        { provide: SocialConnectionRepository, useValue: repo },
        { provide: SocialPlatformSettingRepository, useValue: settingsRepo },
        { provide: SocialVerificationService, useValue: verification },
        { provide: UsersService, useValue: users },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<SocialsService>(SocialsService);
  });

  it('list returns a card for every supported platform', async () => {
    repo.findByUser.mockResolvedValue([
      conn({ platform: SocialPlatform.INSTAGRAM, username: 'jane', followerCount: 12400 }),
    ]);

    const result = await service.list(userId);

    expect(result).toHaveLength(5);
    const ig = result.find((c) => c.platform === SocialPlatform.INSTAGRAM)!;
    expect(ig.connected).toBe(true);
    expect(ig.username).toBe('jane');
    expect(ig.followerCount).toBe(12400);
    expect(ig.minFollowers).toBe(1000);
    const yt = result.find((c) => c.platform === SocialPlatform.YOUTUBE)!;
    expect(yt.connected).toBe(false);
    expect(yt.minFollowers).toBe(500);
  });

  it('connect verifies, persists and assigns a tier from the follower count', async () => {
    verification.verify.mockResolvedValue({
      platformUserId: 'tt-1',
      username: 'creator',
      followerCount: 15000,
      accessToken: 'tok',
    });
    repo.findByUser.mockResolvedValue([
      conn({ platform: SocialPlatform.TIKTOK, username: 'creator', followerCount: 15000 }),
    ]);

    const result = await service.connect(userId, 'tiktok', {
      code: 'c',
      redirectUri: 'r',
    });

    expect(verification.verify).toHaveBeenCalledWith(SocialPlatform.TIKTOK, {
      code: 'c',
      redirectUri: 'r',
    });
    expect(repo.upsert).toHaveBeenCalledWith(
      userId,
      SocialPlatform.TIKTOK,
      expect.objectContaining({ username: 'creator', followerCount: 15000, isVerified: true }),
    );
    // Tier + denormalized columns synced onto the user record.
    expect(users.update).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        tiktokUsername: 'creator',
        tiktokFollowers: 15000,
        assignedTier: 'Micro Creator',
      }),
    );
    expect(result.tier).toBe('Micro Creator');
    expect(result.message).toContain('TikTok');
  });

  it('connect rejects a platform account already linked to another Trendupp profile', async () => {
    verification.verify.mockResolvedValue({
      platformUserId: 'tt-1',
      username: 'creator',
      followerCount: 15000,
      accessToken: 'tok',
    });
    repo.findByPlatformAccount.mockResolvedValue(
      conn({ platform: SocialPlatform.TIKTOK, userId: 'someone-else' }),
    );

    await expect(
      service.connect(userId, 'tiktok', { code: 'c', redirectUri: 'r' }),
    ).rejects.toThrow(ConflictException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('connect allows reconnecting the same account for the same user', async () => {
    verification.verify.mockResolvedValue({
      platformUserId: 'tt-1',
      username: 'creator',
      followerCount: 15000,
      accessToken: 'tok',
    });
    repo.findByPlatformAccount.mockResolvedValue(conn({ platform: SocialPlatform.TIKTOK, userId }));
    repo.findByUser.mockResolvedValue([
      conn({ platform: SocialPlatform.TIKTOK, username: 'creator', followerCount: 15000 }),
    ]);

    await expect(
      service.connect(userId, 'tiktok', { code: 'c', redirectUri: 'r' }),
    ).resolves.toBeDefined();
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('connect rejects an account below the platform minimum', async () => {
    verification.verify.mockResolvedValue({
      username: 'small',
      followerCount: 200, // YouTube min is 500
    });

    await expect(
      service.connect(userId, 'youtube', { code: 'c', redirectUri: 'r' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  });

  it('connect honors a lowered minimum from social_platform_settings', async () => {
    // DB override (e.g. dev environment): YouTube minimum dropped to 0
    settingsRepo.getMinFollowers.mockResolvedValue({
      instagram: 1000,
      tiktok: 1000,
      youtube: 0,
      twitter: 500,
      facebook: 1000,
    });
    verification.verify.mockResolvedValue({
      platformUserId: 'yt-1',
      username: 'fresh_channel',
      followerCount: 0,
      accessToken: 'tok',
    });
    repo.findByUser.mockResolvedValue([]);

    await expect(
      service.connect(userId, 'youtube', { code: 'c', redirectUri: 'r' }),
    ).resolves.toBeDefined();
    expect(repo.upsert).toHaveBeenCalled();
  });

  it('connect rejects an unsupported platform before any OAuth call', async () => {
    await expect(
      service.connect(userId, 'linkedin', { code: 'c', redirectUri: 'r' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(verification.verify).not.toHaveBeenCalled();
  });

  it('disconnect removes the connection and recomputes the tier from what remains', async () => {
    repo.findByUser.mockResolvedValue([]); // nothing left after removal

    const result = await service.disconnect(userId, 'tiktok');

    expect(repo.removeByUserAndPlatform).toHaveBeenCalledWith(userId, SocialPlatform.TIKTOK);
    expect(users.update).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        tiktokUsername: null,
        tiktokFollowers: 0,
        assignedTier: 'Nano Creator',
      }),
    );
    expect(result.tier).toBe('Nano Creator');
  });

  it('refresh throws NotFound when the platform is not connected', async () => {
    repo.findByUserAndPlatform.mockResolvedValue(null);
    await expect(service.refresh(userId, 'tiktok')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refresh throws Conflict when there is no stored token to re-verify with', async () => {
    repo.findByUserAndPlatform.mockResolvedValue(
      conn({ platform: SocialPlatform.TIKTOK, accessToken: null }),
    );
    await expect(service.refresh(userId, 'tiktok')).rejects.toBeInstanceOf(ConflictException);
  });
});
