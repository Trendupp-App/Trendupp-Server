import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'marketing_budgets' })
export class MarketingBudget extends BaseEntity<MarketingBudget> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare value: string;

  @Column({ type: DataType.STRING(3), allowNull: false })
  declare currency: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'min_value' })
  declare minValue: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_value' })
  declare maxValue?: number | null;
}
