import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'banner_ads' })
export class BannerAd extends BaseEntity<BannerAd> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'Banner',
    field: 'ad_type',
  })
  declare adType: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: ['All Creators'],
    field: 'target_audience',
  })
  declare targetAudience: string[];

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: ['Home Page'],
    field: 'placement',
  })
  declare placement: string[];

  @Column({ type: DataType.STRING, allowNull: false, field: 'ad_image_url' })
  declare adImageUrl: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'link_url' })
  declare linkUrl?: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'start_date' })
  declare startDate?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'end_date' })
  declare endDate?: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'draft',
  })
  declare status: string; // 'draft' | 'active' | 'scheduled' | 'paused' | 'archived'

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare impressions: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare clicks: number;

  @Column(DataType.VIRTUAL)
  get ctr(): number {
    if (!this.impressions || this.impressions === 0) return 0;
    return parseFloat((((this.clicks || 0) / this.impressions) * 100).toFixed(1));
  }
}
