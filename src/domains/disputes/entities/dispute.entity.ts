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

  // --- Audit / event-driven fields ---

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'activated_by_id' })
  declare activatedById?: string;

  @BelongsTo(() => User, 'activated_by_id')
  declare activatedBy?: User;

  @Column({ type: DataType.DATE, allowNull: true, field: 'activated_at' })
  declare activatedAt?: Date;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'resolved_by_id' })
  declare resolvedById?: string;

  @BelongsTo(() => User, 'resolved_by_id')
  declare resolvedBy?: User;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'resolution_notes' })
  declare resolutionNotes?: string;
}
