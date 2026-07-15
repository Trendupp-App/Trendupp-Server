import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'campaign_reviews' })
export class CampaignReview extends BaseEntity<CampaignReview> {
  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'campaign_id',
  })
  campaignId: string;

  @BelongsTo(() => Campaign)
  campaign: Campaign;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'brand_id',
  })
  brandId: string;

  @BelongsTo(() => User, 'brand_id')
  brand: User;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'creator_id',
  })
  creatorId: string;

  @BelongsTo(() => User, 'creator_id')
  creator: User;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'star_rating',
  })
  starRating: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  comment?: string;
}
