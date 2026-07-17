import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SocialPlatformSetting } from '../entities/social-platform-setting.entity';
import { MIN_FOLLOWERS, SocialPlatform } from '../constants/social-platforms';

@Injectable()
export class SocialPlatformSettingRepository {
  constructor(
    @InjectModel(SocialPlatformSetting)
    private readonly model: typeof SocialPlatformSetting,
  ) {}

  /**
   * Effective min-followers per platform: DB rows override the code defaults,
   * platforms without a row fall back to MIN_FOLLOWERS. One query, used by
   * both the connect eligibility check and the platform-card listing.
   */
  async getMinFollowers(): Promise<Record<SocialPlatform, number>> {
    const rows = await this.model.findAll();
    const result = { ...MIN_FOLLOWERS };
    for (const row of rows) {
      if (row.platform in result) {
        result[row.platform as SocialPlatform] = row.minFollowers;
      }
    }
    return result;
  }
}
