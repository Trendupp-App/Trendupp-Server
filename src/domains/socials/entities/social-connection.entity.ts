import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';
import { SocialPlatform } from '../constants/social-platforms';

/**
 * A verified link between a user and one social platform.
 *
 * One row per (user, platform) — enforced by a unique constraint defined in
 * the migration. Disconnecting hard-deletes the row so the unique constraint
 * stays clean and a fresh reconnect is always possible.
 */
@Table({ tableName: 'social_connections' })
export class SocialConnection extends BaseEntity<SocialConnection> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @Column({ type: DataType.STRING, allowNull: false })
  declare platform: SocialPlatform;

  /** The platform-side identity (TikTok open_id, IG user id, YouTube channel id, X user id). */
  @Column({ type: DataType.STRING, allowNull: true, field: 'platform_user_id' })
  declare platformUserId?: string | null;

  @Column({ type: DataType.STRING, allowNull: true })
  declare username?: string | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'avatar_url' })
  declare avatarUrl?: string | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'follower_count' })
  declare followerCount: number;

  /** True once the follower count has been pulled directly from the platform API. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_verified' })
  declare isVerified: boolean;

  /** 'connected' | 'expired' | 'revoked' — room to model token lifecycle later. */
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'connected' })
  declare status: string;

  // OAuth tokens kept for background re-verification / refresh.
  // TODO(security): encrypt these at rest before storing real long-lived tokens.
  @Column({ type: DataType.TEXT, allowNull: true, field: 'access_token' })
  declare accessToken?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'refresh_token' })
  declare refreshToken?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'token_expires_at' })
  declare tokenExpiresAt?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'last_verified_at' })
  declare lastVerifiedAt?: Date | null;
}
