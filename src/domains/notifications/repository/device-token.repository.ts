import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { DeviceToken } from '../entities/device-token.entity';

/**
 * Storage for FCM device registration tokens.
 *
 * Tokens are hard-deleted (`force: true`): a dead token has no audit value,
 * and soft-deleted rows would collide with the partial unique index when the
 * same device re-registers.
 */
@Injectable()
export class DeviceTokenRepository {
  constructor(
    @InjectModel(DeviceToken)
    private readonly deviceTokenModel: typeof DeviceToken,
  ) {}

  /**
   * Idempotent register. If the token already exists it is reassigned to
   * this user (same device, new login) and its platform refreshed.
   */
  async register(userId: string, token: string, platform: string): Promise<DeviceToken> {
    const existing = await this.deviceTokenModel.findOne({ where: { token } });
    if (existing) {
      return existing.update({ userId, platform });
    }
    try {
      return await this.deviceTokenModel.create({ userId, token, platform } as DeviceToken);
    } catch (error) {
      // Concurrent register of the same token (e.g. app retry): fall back to update.
      if (error instanceof UniqueConstraintError) {
        const row = await this.deviceTokenModel.findOne({ where: { token } });
        if (row) return row.update({ userId, platform });
      }
      throw error;
    }
  }

  /** Remove one token, only if it belongs to the caller. Returns rows removed. */
  removeByToken(userId: string, token: string): Promise<number> {
    return this.deviceTokenModel.destroy({ where: { userId, token }, force: true });
  }

  findAllForUser(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenModel.findAll({
      attributes: ['id', 'token', 'platform'],
      where: { userId },
    });
  }

  /** Prune tokens FCM reported as invalid/unregistered. */
  async removeTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    return this.deviceTokenModel.destroy({ where: { token: tokens }, force: true });
  }
}
