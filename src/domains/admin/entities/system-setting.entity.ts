import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'system_settings' })
export class SystemSetting extends BaseEntity<SystemSetting> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare key: string;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare value: Record<string, any>;
}
