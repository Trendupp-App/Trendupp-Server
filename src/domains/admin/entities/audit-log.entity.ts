import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'audit_logs', paranoid: false })
export class AuditLog extends BaseEntity<AuditLog> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'admin_id' })
  declare adminId: string;

  @BelongsTo(() => User, 'admin_id')
  declare admin: User;

  @Column({ type: DataType.STRING, allowNull: false })
  declare action: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'target_user_id' })
  declare targetUserId?: string | null;

  @BelongsTo(() => User, 'target_user_id')
  declare targetUser?: User | null;

  @Column({ type: DataType.STRING, allowNull: true, field: 'ip_address' })
  declare ipAddress?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'user_agent' })
  declare userAgent?: string | null;

  @Column({ type: DataType.JSONB, allowNull: true, defaultValue: {} })
  declare details?: Record<string, unknown> | null;
}
