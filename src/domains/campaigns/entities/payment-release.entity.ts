import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { CampaignApplication } from './campaign-application.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'payment_releases' })
export class PaymentRelease extends BaseEntity<PaymentRelease> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'creator_id' })
  declare creatorId: string;

  @BelongsTo(() => User)
  declare creator: User;

  @ForeignKey(() => CampaignApplication)
  @Column({ type: DataType.UUID, allowNull: false, field: 'application_id' })
  declare applicationId: string;

  @BelongsTo(() => CampaignApplication)
  declare application: CampaignApplication;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare amount: number;

  @Column({ type: DataType.DATE, allowNull: false, field: 'release_date' })
  declare releaseDate: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: string; // 'pending' | 'escrow_pending' | 'released' | 'failed'

  /**
   * The Pandascrow escrow ID linked to this release.
   * Populated from Payment.escrowId at the time the release is created.
   * Used by the payout cron to verify escrow is completed before bank transfer.
   */
  @Column({ type: DataType.STRING, allowNull: true, field: 'escrow_id' })
  declare escrowId?: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'error_details' })
  declare errorDetails?: string | null;
}
