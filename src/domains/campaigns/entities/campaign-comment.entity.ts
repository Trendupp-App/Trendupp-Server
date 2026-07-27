import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'campaign_comments' })
export class CampaignComment extends BaseEntity<CampaignComment> {
  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'campaign_id',
  })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'creator_id',
  })
  declare creatorId: string;

  @BelongsTo(() => User, 'creator_id')
  declare creator: User;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'brand_id',
  })
  declare brandId: string;

  @BelongsTo(() => User, 'brand_id')
  declare brand: User;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare comment: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare response?: string;
}
