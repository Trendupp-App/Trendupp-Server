import { Table, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { Platform } from './platform.entity';

@Table({ tableName: 'campaign_platforms' })
export class CampaignPlatform extends BaseEntity<CampaignPlatform> {
  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'campaign_id',
  })
  declare campaignId: string;

  @ForeignKey(() => Platform)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'platform_id',
  })
  declare platformId: string;
}
