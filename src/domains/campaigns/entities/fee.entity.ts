import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'fees' })
export class Fee extends BaseEntity<Fee> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  /**
   * Type of fee: 'percentage' | 'flat'
   */
  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'percentage' })
  declare type: string;

  /**
   * The value of the fee (e.g. 0.15 for 15% fee, or a flat rate amount)
   */
  @Column({ type: DataType.FLOAT, allowNull: false })
  declare value: number;
}
