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
import { SocialVerificationService } from './social-verification.service';
import { UsersService } from '../../users/services/users.service';
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
  let verification: jest.Mocked<SocialVerificationService>;
  let users: jest.Mocked<UsersService>;

  const userId = 'user-1';

  beforeEach(async () => {
    repo = {
      findByUser: jest.fn().mockResolvedValue([]),
      findByUserAndPlatform: jest.fn(),
      upsert: jest.fn().mockResolvedValue(conn({})),
      removeByUserAndPlatform: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<SocialConnectionRepository>;

    verification = {
      verify: jest.fn(),
      refreshStats: jest.fn(),
    } as unknown as jest.Mocked<SocialVerificationService>;

    users = {
      update: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialsService,
        { provide: SocialConnectionRepository, useValue: repo },
        { provide: SocialVerificationService, useValue: verification },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    service = module.get<SocialsService>(SocialsService);
  });

  it('list returns a card for every supported platform', async () => {
    repo.findByUser.mockResolvedValue([
      conn({ platform: SocialPlatform.INSTAGRAM, username: 'jane', followerCount: 12400 }),
    ]);

    const result = await service.list(userId);

    expect(result).toHaveLength(4);
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

  it('connect rejects an unsupported platform before any OAuth call', async () => {
    await expect(
      service.connect(userId, 'facebook', { code: 'c', redirectUri: 'r' }),
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
