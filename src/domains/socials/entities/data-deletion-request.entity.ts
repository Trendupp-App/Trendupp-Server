import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One row per Meta data-deletion callback (Facebook/Instagram). The
 * confirmation code is what the user sees and can look up at
 * <web>/data-deletion?code=..., as Meta's policy requires.
 */
@Table({ tableName: 'data_deletion_requests' })
export class DataDeletionRequest extends BaseEntity<DataDeletionRequest> {
  @Column({ type: DataType.STRING(32), allowNull: false, field: 'confirmation_code' })
  declare confirmationCode: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  declare platform: string; // 'instagram' | 'facebook'

  @Column({ type: DataType.STRING, allowNull: false, field: 'platform_user_id' })
  declare platformUserId: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'user_id' })
  declare userId?: string | null;

  @BelongsTo(() => User, 'user_id')
  declare user?: User | null;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'completed' })
  declare status: string; // 'completed' | 'no_data' | 'failed'

  @Column({ type: DataType.TEXT, allowNull: true })
  declare details?: string | null;
}
