import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SocialConnection } from '../entities/social-connection.entity';
import { SocialPlatform } from '../constants/social-platforms';

export type SocialConnectionData = Partial<{
  platformUserId: string | null;
  username: string | null;
  avatarUrl: string | null;
  followerCount: number;
  isVerified: boolean;
  status: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  lastVerifiedAt: Date | null;
}>;

@Injectable()
export class SocialConnectionRepository {
  constructor(
    @InjectModel(SocialConnection)
    private readonly model: typeof SocialConnection,
  ) {}

  findByUser(userId: string): Promise<SocialConnection[]> {
    return this.model.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
  }

  findByUserAndPlatform(
    userId: string,
    platform: SocialPlatform,
  ): Promise<SocialConnection | null> {
    return this.model.findOne({ where: { userId, platform } });
  }

  /** Create the connection, or update it in place if one already exists. */
  async upsert(
    userId: string,
    platform: SocialPlatform,
    data: SocialConnectionData,
  ): Promise<SocialConnection> {
    const existing = await this.model.findOne({ where: { userId, platform } });
    if (existing) {
      await existing.update(data);
      return existing;
    }
    // Cast at the creation boundary — Sequelize's creation-attributes generic
    // cannot be satisfied through this partial shape (same pattern as BaseService).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.model as any).create({ userId, platform, ...data }) as Promise<SocialConnection>;
  }

  /** Hard-delete so the (user, platform) unique constraint stays clean for reconnects. */
  removeByUserAndPlatform(userId: string, platform: SocialPlatform): Promise<number> {
    return this.model.destroy({ where: { userId, platform }, force: true });
  }
}
