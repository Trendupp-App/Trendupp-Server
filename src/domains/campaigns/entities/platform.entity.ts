import { Table, Column, DataType, BelongsToMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { CampaignPlatform } from './campaign-platform.entity';

@Table({ tableName: 'platforms' })
export class Platform extends BaseEntity<Platform> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @BelongsToMany(() => Campaign, () => CampaignPlatform)
  declare campaigns?: Campaign[];
}
