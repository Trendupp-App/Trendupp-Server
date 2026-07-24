import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'faqs' })
export class Faq extends BaseEntity<Faq> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare question: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare answer: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'General' })
  declare category: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'published' })
  declare status: string; // 'published' | 'draft'

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' })
  declare sortOrder: number;
}
