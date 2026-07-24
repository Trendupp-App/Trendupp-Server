import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'news_categories' })
export class NewsCategory extends BaseEntity<NewsCategory> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;
}
