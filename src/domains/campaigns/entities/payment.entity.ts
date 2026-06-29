import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';

@Table({ tableName: 'payments' })
export class Payment extends BaseEntity<Payment> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare amount: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'unpaid',
    field: 'payment_status',
  })
  declare paymentStatus: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'payment_reference' })
  declare paymentReference?: string;
}
