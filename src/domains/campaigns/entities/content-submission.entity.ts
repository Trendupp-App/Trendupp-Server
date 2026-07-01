import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';
import { CampaignApplication } from './campaign-application.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'content_submissions' })
export class ContentSubmission extends BaseEntity<ContentSubmission> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @ForeignKey(() => CampaignApplication)
  @Column({ type: DataType.UUID, allowNull: false, field: 'application_id' })
  declare applicationId: string;

  @BelongsTo(() => CampaignApplication)
  declare application: CampaignApplication;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'creator_id' })
  declare creatorId: string;

  @BelongsTo(() => User)
  declare creator: User;

  @Column({ type: DataType.STRING, allowNull: true, field: 'draft_link' })
  declare draftLink?: string;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'live_link' })
  declare liveLink?: Record<string, string>;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending_approval',
  })
  declare status: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'brand_feedback' })
  declare brandFeedback?: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: true, field: 'url_is_live' })
  declare urlIsLive?: boolean;

  @Column({ type: DataType.DATE, allowNull: true, field: 'url_checked_at' })
  declare urlCheckedAt?: Date;
}
