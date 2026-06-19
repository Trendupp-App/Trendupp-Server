import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Campaign } from './campaign.entity';

@Table({ tableName: 'creator_categories' })
export class CreatorCategory extends BaseEntity<CreatorCategory> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'min_followers' })
  declare minFollowers: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'max_followers' })
  declare maxFollowers?: number;

  @HasMany(() => Campaign)
  declare campaigns?: Campaign[];
}
