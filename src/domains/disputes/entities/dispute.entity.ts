import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'disputes' })
export class Dispute extends BaseEntity<Dispute> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'creator_id' })
  declare creatorId: string;

  @BelongsTo(() => User, 'creator_id')
  declare creator: User;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'brand_id' })
  declare brandId: string;

  @BelongsTo(() => User, 'brand_id')
  declare brand: User;

  @Column({
    type: DataType.ENUM('raised', 'under_review', 'resolved'),
    allowNull: false,
    defaultValue: 'raised',
  })
  declare status: 'raised' | 'under_review' | 'resolved';

  @Column({ type: DataType.TEXT, allowNull: false })
  declare reason: string;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'stream_channel_id' })
  declare streamChannelId?: string;

  @Column({
    type: DataType.ENUM('release_to_creator', 'refund_to_brand', 'split'),
    allowNull: true,
    field: 'escrow_action',
  })
  declare escrowAction?: 'release_to_creator' | 'refund_to_brand' | 'split';

  @Column({ type: DataType.DATE, allowNull: true, field: 'resolved_at' })
  declare resolvedAt?: Date;
}
