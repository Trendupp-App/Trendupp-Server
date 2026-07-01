import { Table, Column, DataType, BelongsToMany, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';
import { UserNiche } from './user-niche.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';

@Table({ tableName: 'niches' })
export class Niche extends BaseEntity<Niche> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare order: number;

  @BelongsToMany(() => User, () => UserNiche)
  declare users: User[];

  @HasMany(() => Campaign)
  declare campaigns?: Campaign[];
}
