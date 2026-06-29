import { Table, Column, DataType, ForeignKey, BelongsTo, HasMany } from 'sequelize-typescript';
import { ContentSubmission } from './content-submission.entity';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { User } from '../../users/entities/user.entity';
import { Platform } from './platform.entity';

@Table({ tableName: 'campaign_applications' })
export class CampaignApplication extends BaseEntity<CampaignApplication> {
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

  @Column({ type: DataType.TEXT, allowNull: false, field: 'content_idea' })
  declare contentIdea: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'past_work_link' })
  declare pastWorkLink?: string;

  @ForeignKey(() => Platform)
  @Column({ type: DataType.UUID, allowNull: false, field: 'primary_platform_id' })
  declare primaryPlatformId: string;

  @BelongsTo(() => Platform, 'primary_platform_id')
  declare primaryPlatform: Platform;

  @ForeignKey(() => Platform)
  @Column({ type: DataType.UUID, allowNull: true, field: 'secondary_platform_id' })
  declare secondaryPlatformId?: string;

  @BelongsTo(() => Platform, 'secondary_platform_id')
  declare secondaryPlatform?: Platform;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'fee_request' })
  declare feeRequest: number;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare comments?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: string;

  @HasMany(() => ContentSubmission)
  declare submissions?: ContentSubmission[];
}
