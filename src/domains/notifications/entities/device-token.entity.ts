import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One FCM registration token = one app install on one physical device.
 * A user can have several (phone + tablet); a token belongs to exactly one
 * user — re-registering an existing token under a new account reassigns it
 * (same device, different login).
 */
@Table({ tableName: 'device_tokens' })
export class DeviceToken extends BaseEntity<DeviceToken> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => User, 'user_id')
  declare user: User;

  /** FCM registration token (opaque, can exceed 255 chars). */
  @Column({ type: DataType.TEXT, allowNull: false })
  declare token: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare platform: string; // 'android' | 'ios'
}
