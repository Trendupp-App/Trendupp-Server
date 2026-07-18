import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { User } from '../../users/entities/user.entity';

export type CampaignRefundStatus = 'pending' | 'completed' | 'failed' | 'pending_bank_details';

@Table({ tableName: 'campaign_refunds', paranoid: false })
export class CampaignRefund extends BaseEntity<CampaignRefund> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'brand_id' })
  declare brandId: string;

  @BelongsTo(() => User)
  declare brand: User;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare amount: number;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: CampaignRefundStatus;

  @Column({ type: DataType.STRING, allowNull: true, field: 'refund_reference' })
  declare refundReference?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'error_details' })
  declare errorDetails?: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'release_date',
  })
  declare releaseDate: Date;
}
