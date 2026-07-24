import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'brand_commission_tiers' })
export class BrandCommissionTier extends BaseEntity<BrandCommissionTier> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    defaultValue: 15.0,
    field: 'rate_percentage',
  })
  declare ratePercentage: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_default',
  })
  declare isDefault: boolean;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare reason?: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
    field: 'brand_ids',
  })
  declare brandIds: string[];
}
