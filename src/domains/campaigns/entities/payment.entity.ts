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

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'total_amount' })
  declare totalAmount?: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'unpaid',
    field: 'payment_status',
  })
  declare paymentStatus: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'payment_reference' })
  declare paymentReference?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'escrow_id' })
  declare escrowId?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'payment_url' })
  declare paymentUrl?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'transaction_ref' })
  declare transactionRef?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'provider' })
  declare provider?: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'escrow_status' })
  declare escrowStatus?: string;
}
