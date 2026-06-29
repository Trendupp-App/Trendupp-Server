import {
  Table,
  Column,
  DataType,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from './creator-category.entity';
import { Platform } from './platform.entity';
import { CampaignPlatform } from './campaign-platform.entity';
import { Payment } from './payment.entity';
import { CampaignApplication } from './campaign-application.entity';
import { ContentSubmission } from './content-submission.entity';

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

  @ForeignKey(() => CreatorCategory)
  @Column({ type: DataType.UUID, allowNull: true, field: 'creator_category_id' })
  declare creatorCategoryId?: string;

  @BelongsTo(() => CreatorCategory)
  declare creatorCategory?: CreatorCategory;

  @BelongsToMany(() => Platform, () => CampaignPlatform)
  declare preferredPlatforms?: Platform[];

  @Column({ type: DataType.JSON, allowNull: true, field: 'content_guidelines' })
  declare contentGuidelines?: { dos: string[]; donts: string[] };

  @Column({ type: DataType.JSON, allowNull: true })
  declare deliverables?: string[];

  @Column({ type: DataType.JSON, allowNull: true, field: 'content_direction' })
  declare contentDirection?: string[];

  @Column({ type: DataType.TEXT, allowNull: true, field: 'usage_rights' })
  declare usageRights?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'success_looks_like' })
  declare successLooksLike?: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'campaign_brief' })
  declare campaignBrief?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'accepted_terms',
  })
  declare acceptedTerms: boolean;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1, field: 'current_step' })
  declare currentStep: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'unpaid',
    field: 'payment_status',
  })
  declare paymentStatus: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'cover_image' })
  declare coverImage?: string;

  /**
   * Campaign lifecycle status.
   * Possible values: 'draft' | 'pending_approval' | 'live' | 'active' | 'completed' | 'cancelled'
   */
  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'draft',
  })
  declare status: string;

  /** Set by admin when the campaign is approved and goes live. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'approved_at' })
  declare approvedAt?: Date;

  @Column({ type: DataType.BOOLEAN, allowNull: true, field: 'url_is_live' })
  declare urlIsLive?: boolean;

  /**
   * Determines whether this campaign is currently live.
   */
  get isLive(): boolean {
    return this.status === 'live';
  }

  /**
   * Determines whether this campaign is past (expired or completed).
   */
  get isPast(): boolean {
    return this.status === 'completed' || this.status === 'cancelled';
  }

  /**
   * Returns string e.g. "3/5 sections" based on currentStep progress
   */
  get sectionsProgress(): string {
    if (this.status !== 'draft') {
      return '5/5 sections';
    }
    return `${this.currentStep - 1}/5 sections`;
  }

  /**
   * Returns progress percentage (e.g. 20% for step 1, 40% for step 2, etc.)
   */
  get progressPercentage(): number {
    if (this.status !== 'draft') {
      return 100;
    }
    switch (this.currentStep) {
      case 1:
        return 20;
      case 2:
        return 40;
      case 3:
        return 60;
      case 4:
        return 80;
      case 5:
        return 90;
      default:
        return 0;
    }
  }

  /**
   * Returns dynamic billing breakdown based on the budget
   */
  get paymentBreakdown(): {
    campaignBudget: number;
    trenduppFee: number;
    vat: number;
    totalToPay: number;
  } {
    const budget = this.totalBudget || 0;
    const fee = budget * 0.15;
    const vat = budget * 0.075;
    return {
      campaignBudget: budget,
      trenduppFee: fee,
      vat,
      totalToPay: budget + fee + vat,
    };
  }

  @HasMany(() => Payment)
  declare payments?: Payment[];

  @HasMany(() => CampaignApplication)
  declare applications?: CampaignApplication[];

  @HasMany(() => ContentSubmission)
  declare submissions?: ContentSubmission[];
}
