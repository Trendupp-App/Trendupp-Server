import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { UsersService } from '../../users/services/users.service';
import { User } from '../../users/entities/user.entity';
import { SocialConnection } from '../entities/social-connection.entity';
import { SocialConnectionRepository } from '../repository/social-connection.repository';
import { SocialVerificationService } from './social-verification.service';
import { ConnectSocialDto } from '../dtos/connect-social.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SocialPlatformSettingRepository } from '../repository/social-platform-setting.repository';
import {
  computeTier,
  isSocialPlatform,
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
  [SocialPlatform.FACEBOOK]: { username: 'facebookUsername', followers: 'facebookFollowers' },
};

@Injectable()
export class SocialsService {
  private readonly logger = new Logger(SocialsService.name);

  constructor(
    private readonly repo: SocialConnectionRepository,
    private readonly settingsRepo: SocialPlatformSettingRepository,
    private readonly verification: SocialVerificationService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Full set of platform cards (connected or not) for the Connect Socials screen. */
  async list(userId: string): Promise<SocialConnectionView[]> {
    const [connections, minFollowers, enabled] = await Promise.all([
      this.repo.findByUser(userId),
      this.settingsRepo.getMinFollowers(),
      this.settingsRepo.getEnabled(),
    ]);
    // Disabled platforms are hidden entirely — web and mobile both render
    // this list verbatim, so the flag needs no client-side logic.
    return SOCIAL_PLATFORMS.filter((platform) => enabled[platform]).map((platform) =>
      this.toView(
        platform,
        minFollowers[platform],
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

    const enabled = await this.settingsRepo.getEnabled();
    if (!enabled[platform]) {
      throw new ForbiddenException(
        `Connecting ${PLATFORM_LABELS[platform]} is currently unavailable.`,
      );
    }

    const verified = await this.verification.verify(platform, dto);

    // One social account backs exactly one Trendupp profile. Backstopped by
    // the unique (platform, platform_user_id) index — this check just gives
    // a friendly error instead of a raw constraint violation.
    if (verified.platformUserId) {
      const owner = await this.repo.findByPlatformAccount(platform, verified.platformUserId);
      if (owner && owner.userId !== userId) {
        throw new ConflictException(
          `This ${PLATFORM_LABELS[platform]} account is already linked to another Trendupp profile. ` +
            `If you believe this is an error, please contact support.`,
        );
      }
    }

    // Runtime-editable threshold from social_platform_settings (code defaults as fallback)
    const min = (await this.settingsRepo.getMinFollowers())[platform];
    if (verified.followerCount < min) {
      throw new UnprocessableEntityException(
        `${PLATFORM_LABELS[platform]} requires at least ${min.toLocaleString()} followers to connect. ` +
          `This account has ${verified.followerCount.toLocaleString()}.`,
      );
    }

    try {
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
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        // Race with a concurrent connect of the same platform account —
        // the unique (platform, platform_user_id) index is the authority.
        throw new ConflictException(
          `This ${PLATFORM_LABELS[platform]} account is already linked to another Trendupp profile. ` +
            `If you believe this is an error, please contact support.`,
        );
      }
      throw error;
    }

    const tier = await this.syncUserAndTier(userId);
    const connections = await this.list(userId);
    this.logger.log(
      `User ${userId} connected ${platform} (@${verified.username}, ${verified.followerCount} followers) → ${tier}`,
    );

    await this.notificationsService.notify({
      type: 'social.connected',
      recipientId: userId,
      data: {
        platform,
        platformLabel: PLATFORM_LABELS[platform],
        username: verified.username,
        followerCount: verified.followerCount,
        tier,
      },
    });

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

    await this.notificationsService.notify({
      type: 'social.disconnected',
      recipientId: userId,
      data: { platform, platformLabel: PLATFORM_LABELS[platform], tier },
    });

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

  private toView(
    platform: SocialPlatform,
    minFollowers: number,
    conn?: SocialConnection,
  ): SocialConnectionView {
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      connected: !!conn,
      verified: conn?.isVerified ?? false,
      username: conn?.username ?? null,
      followerCount: conn?.followerCount ?? 0,
      avatarUrl: conn?.avatarUrl ?? null,
      minFollowers,
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
