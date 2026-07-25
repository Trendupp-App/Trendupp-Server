import { Table, Column, DataType, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';
import { Industry } from '../../users/entities/industry.entity';

@Table({ tableName: 'news', paranoid: true })
export class News extends BaseEntity<News> {
  @Column({ type: DataType.TEXT, allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare summary: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare content: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'cover_image' })
  declare coverImage: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare category: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'draft' })
  declare status: string; // 'draft' | 'published'

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_platform_update',
  })
  declare isPlatformUpdate: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_top_news' })
  declare isTopNews: boolean;

  @ForeignKey(() => Industry)
  @Column({ type: DataType.UUID, allowNull: true, field: 'industry_id' })
  declare industryId: string;

  @BelongsTo(() => Industry)
  declare industry: Industry;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'author_id' })
  declare authorId: string;

  @BelongsTo(() => User)
  declare author: User;

  @Column({ type: DataType.DATE, allowNull: true, field: 'published_at' })
  declare publishedAt: Date;
}
