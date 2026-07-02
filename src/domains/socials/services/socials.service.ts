import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';
import { SocialConnection } from '../entities/social-connection.entity';
import { SocialConnectionRepository } from '../repository/social-connection.repository';
import { SocialVerificationService } from './social-verification.service';
import { ConnectSocialDto } from '../dtos/connect-social.dto';
import {
  computeTier,
  isSocialPlatform,
  MIN_FOLLOWERS,
  PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  SocialPlatform,
} from '../constants/social-platforms';

export interface SocialConnectionView {
  platform: SocialPlatform;
  label: string;
  connected: boolean;
  verified: boolean;
  username: string | null;
  followerCount: number;
  avatarUrl: string | null;
  minFollowers: number;
  connectedAt: Date | null;
}

export interface SocialsMutationResult {
  message: string;
  tier: string;
  connections: SocialConnectionView[];
  connection?: SocialConnectionView;
}

/** Maps a platform to the denormalized username/followers columns on the user record. */
const USER_FIELD_MAP: Record<SocialPlatform, { username: keyof User; followers: keyof User }> = {
  [SocialPlatform.INSTAGRAM]: { username: 'instagramUsername', followers: 'instagramFollowers' },
  [SocialPlatform.TIKTOK]: { username: 'tiktokUsername', followers: 'tiktokFollowers' },
  [SocialPlatform.YOUTUBE]: { username: 'youtubeUsername', followers: 'youtubeFollowers' },
  [SocialPlatform.TWITTER]: { username: 'twitterUsername', followers: 'twitterFollowers' },
};

@Injectable()
export class SocialsService {
  private readonly logger = new Logger(SocialsService.name);

  constructor(
    private readonly repo: SocialConnectionRepository,
    private readonly verification: SocialVerificationService,
    private readonly usersService: UsersService,
  ) {}

  /** Full set of platform cards (connected or not) for the Connect Socials screen. */
  async list(userId: string): Promise<SocialConnectionView[]> {
    const connections = await this.repo.findByUser(userId);
    return SOCIAL_PLATFORMS.map((platform) =>
      this.toView(
        platform,
        connections.find((c) => c.platform === platform),
      ),
    );
  }

  /** OAuth-verify a platform, enforce the follower minimum, persist, recompute tier. */
  async connect(
    userId: string,
    platformRaw: string,
    dto: ConnectSocialDto,
  ): Promise<SocialsMutationResult> {
    const platform = this.parsePlatform(platformRaw);
    const verified = await this.verification.verify(platform, dto);

    const min = MIN_FOLLOWERS[platform];
    if (verified.followerCount < min) {
      throw new UnprocessableEntityException(
        `${PLATFORM_LABELS[platform]} requires at least ${min.toLocaleString()} followers to connect. ` +
          `This account has ${verified.followerCount.toLocaleString()}.`,
      );
    }

    await this.repo.upsert(userId, platform, {
      platformUserId: verified.platformUserId ?? null,
      username: verified.username,
      avatarUrl: verified.avatarUrl ?? null,
      followerCount: verified.followerCount,
      isVerified: true,
      status: 'connected',
      accessToken: verified.accessToken ?? null,
      refreshToken: verified.refreshToken ?? null,
      tokenExpiresAt: verified.tokenExpiresAt ?? null,
      lastVerifiedAt: new Date(),
    });

    const tier = await this.syncUserAndTier(userId);
    const connections = await this.list(userId);
    this.logger.log(
      `User ${userId} connected ${platform} (@${verified.username}, ${verified.followerCount} followers) → ${tier}`,
    );

    return {
      message: `${PLATFORM_LABELS[platform]} connected successfully`,
      tier,
      connections,
      connection: connections.find((c) => c.platform === platform),
    };
  }

  /** Remove a connection and recompute tier from whatever remains. */
  async disconnect(userId: string, platformRaw: string): Promise<SocialsMutationResult> {
    const platform = this.parsePlatform(platformRaw);
    await this.repo.removeByUserAndPlatform(userId, platform);
    const tier = await this.syncUserAndTier(userId);
    return {
      message: `${PLATFORM_LABELS[platform]} disconnected`,
      tier,
      connections: await this.list(userId),
    };
  }

  /** Re-pull the follower count for a connected platform using its stored token. */
  async refresh(userId: string, platformRaw: string): Promise<SocialsMutationResult> {
    const platform = this.parsePlatform(platformRaw);
    const existing = await this.repo.findByUserAndPlatform(userId, platform);
    if (!existing) {
      throw new NotFoundException(`${PLATFORM_LABELS[platform]} is not connected`);
    }
    if (!existing.accessToken) {
      throw new ConflictException(
        `${PLATFORM_LABELS[platform]} must be reconnected before stats can be refreshed`,
      );
    }

    const stats = await this.verification.refreshStats(platform, existing.accessToken);
    await existing.update({
      followerCount: stats.followerCount,
      username: stats.username ?? existing.username,
      avatarUrl: stats.avatarUrl ?? existing.avatarUrl,
      lastVerifiedAt: new Date(),
    });

    const tier = await this.syncUserAndTier(userId);
    return {
      message: `${PLATFORM_LABELS[platform]} stats refreshed`,
      tier,
      connections: await this.list(userId),
    };
  }

  private parsePlatform(raw: string): SocialPlatform {
    const value = (raw || '').toLowerCase();
    if (!isSocialPlatform(value)) {
      throw new BadRequestException(
        `Unsupported platform '${raw}'. Supported: ${SOCIAL_PLATFORMS.join(', ')}`,
      );
    }
    return value;
  }

  private toView(platform: SocialPlatform, conn?: SocialConnection): SocialConnectionView {
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      connected: !!conn,
      verified: conn?.isVerified ?? false,
      username: conn?.username ?? null,
      followerCount: conn?.followerCount ?? 0,
      avatarUrl: conn?.avatarUrl ?? null,
      minFollowers: MIN_FOLLOWERS[platform],
      connectedAt: conn?.createdAt ?? null,
    };
  }

  /**
   * Keep the denormalized user.<platform>Username / <platform>Followers columns
   * (which drive `socialsConnected`, onboarding %, and legacy reads) in sync with
   * the connections table, and recompute the creator tier from the max verified count.
   */
  private async syncUserAndTier(userId: string): Promise<string> {
    const connections = await this.repo.findByUser(userId);
    const byPlatform = new Map<SocialPlatform, SocialConnection>(
      connections.map((c) => [c.platform, c]),
    );

    const updates: Record<string, unknown> = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const conn = byPlatform.get(platform);
      const fields = USER_FIELD_MAP[platform];
      updates[fields.username] = conn?.username ?? null;
      updates[fields.followers] = conn?.followerCount ?? 0;
    }

    const maxFollowers = connections.reduce((max, c) => Math.max(max, c.followerCount || 0), 0);
    const tier = computeTier(maxFollowers);
    updates.assignedTier = tier;

    await this.usersService.update(userId, updates);
    return tier;
  }
}
