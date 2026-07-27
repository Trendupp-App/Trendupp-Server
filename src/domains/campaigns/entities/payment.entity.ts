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

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'gateway_fee' })
  declare gatewayFee: number;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'escrow_status' })
  declare escrowStatus?: string;

  /**
   * Snapshotted Trendupp commission rate at the time of payment (e.g. 0.15 = 15%).
   * Stored so the breakdown remains accurate even if the admin later changes the rate.
   */
  @Column({ type: DataType.FLOAT, allowNull: true, field: 'commission_rate' })
  declare commissionRate?: number;

  /**
   * Snapshotted VAT rate at the time of payment (e.g. 0.075 = 7.5%).
   */
  @Column({ type: DataType.FLOAT, allowNull: true, field: 'vat_rate' })
  declare vatRate?: number;

  /**
   * Snapshotted gateway/pandascrow rate at the time of payment (e.g. 0.03 for NGN, 0.05 for USD).
   */
  @Column({ type: DataType.FLOAT, allowNull: true, field: 'gateway_rate' })
  declare gatewayRate?: number;
}
