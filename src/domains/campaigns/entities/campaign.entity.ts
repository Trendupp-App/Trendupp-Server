import {
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
} from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from './creator-category.entity';
import { Platform } from './platform.entity';
import { CampaignPlatform } from './campaign-platform.entity';

@Table({ tableName: 'campaigns' })
export class Campaign extends BaseEntity<Campaign> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'brand_id' })
  declare brandId: string;

  @BelongsTo(() => User)
  declare brand: User;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare goal: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'total_budget' })
  declare totalBudget: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'payment_per_creator' })
  declare paymentPerCreator: string;

  @ForeignKey(() => CreatorCategory)
  @Column({ type: DataType.UUID, allowNull: false, field: 'creator_category_id' })
  declare creatorCategoryId: string;

  @BelongsTo(() => CreatorCategory)
  declare creatorCategory?: CreatorCategory;

  @BelongsToMany(() => Platform, () => CampaignPlatform)
  declare preferredPlatforms?: Platform[];

  @Column({ type: DataType.STRING, allowNull: false, field: 'content_type' })
  declare contentType: string;

  /** Campaign timeline in days (e.g. 10–15 days) */
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare duration: number;

  /** Per-creator content duration constraint, e.g. "30secs - 1min" */
  @Column({ type: DataType.STRING, allowNull: true, field: 'content_duration' })
  declare contentDuration?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'content_guidelines' })
  declare contentGuidelines?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'campaign_rules' })
  declare campaignRules?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'cover_image' })
  declare coverImage?: string;

  /**
   * Campaign lifecycle status.
   * Possible values: 'pending_approval' | 'live' | 'completed' | 'cancelled'
   */
  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'pending_approval',
  })
  declare status: string;

  /** Set by admin when the campaign is approved and goes live. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'approved_at' })
  declare approvedAt?: Date;

  /**
   * Determines whether this campaign is currently live based on
   * its approval date and duration window.
   */
  get isLive(): boolean {
    if (this.status !== 'live' || !this.approvedAt) return false;
    const expiresAt = new Date(this.approvedAt);
    expiresAt.setDate(expiresAt.getDate() + this.duration);
    return new Date() <= expiresAt;
  }

  /**
   * Determines whether this campaign is past (expired or completed).
   */
  get isPast(): boolean {
    if (this.status === 'completed' || this.status === 'cancelled') return true;
    if (this.status === 'live' && this.approvedAt) {
      const expiresAt = new Date(this.approvedAt);
      expiresAt.setDate(expiresAt.getDate() + this.duration);
      return new Date() > expiresAt;
    }
    return false;
  }
}
