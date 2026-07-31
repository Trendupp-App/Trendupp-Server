import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Table({ tableName: 'user_token_ledgers' })
export class UserTokenLedger extends BaseEntity<UserTokenLedger> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: true, field: 'campaign_id' })
  declare campaignId?: string | null;

  @BelongsTo(() => Campaign)
  declare campaign?: Campaign;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'tokens_awarded',
  })
  declare tokensAwarded: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'tokens_remaining',
  })
  declare tokensRemaining: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'awarded_at',
  })
  declare awardedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_expired',
  })
  declare isExpired: boolean;
}
