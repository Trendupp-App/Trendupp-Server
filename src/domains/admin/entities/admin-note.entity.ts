import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'admin_notes', paranoid: false })
export class AdminNote extends BaseEntity<AdminNote> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'target_user_id' })
  declare targetUserId: string;

  @BelongsTo(() => User, 'target_user_id')
  declare targetUser: User;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'admin_id' })
  declare adminId: string;

  @BelongsTo(() => User, 'admin_id')
  declare admin: User;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare note: string;
}
