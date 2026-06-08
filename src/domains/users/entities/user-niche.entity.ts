import { Table, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';
import { Niche } from './niche.entity';

@Table({ tableName: 'user_niches' })
export class UserNiche extends BaseEntity<UserNiche> {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @ForeignKey(() => Niche)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'niche_id',
  })
  declare nicheId: string;
}
