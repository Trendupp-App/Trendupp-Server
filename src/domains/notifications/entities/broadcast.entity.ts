import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'broadcasts', paranoid: true })
export class Broadcast extends BaseEntity<Broadcast> {
  @Column({ type: DataType.TEXT, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare message: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'all' })
  declare audience: string; // 'all' | 'brands' | 'creators'

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'both' })
  declare channel: string; // 'in_app' | 'email' | 'both'

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'draft' })
  declare status: string; // 'draft' | 'sent' | 'scheduled' | 'failed'

  @Column({ type: DataType.DATE, allowNull: true, field: 'scheduled_at' })
  declare scheduledAt?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'sent_at' })
  declare sentAt?: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_recipients',
  })
  declare totalRecipients: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by_id' })
  declare createdById: string;

  @BelongsTo(() => User, 'created_by_id')
  declare createdBy?: User;
}
