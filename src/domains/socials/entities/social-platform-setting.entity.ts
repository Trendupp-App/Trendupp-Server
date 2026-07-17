import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

/**
 * Runtime-editable connect rules per platform. Seeded by the
 * create-social-platform-settings migration; update rows directly (or via a
 * future admin endpoint) to change eligibility without a deploy.
 */
@Table({ tableName: 'social_platform_settings' })
export class SocialPlatformSetting extends BaseEntity<SocialPlatformSetting> {
  @Column({ type: DataType.STRING(16), allowNull: false, unique: true })
  declare platform: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'min_followers' })
  declare minFollowers: number;
}
