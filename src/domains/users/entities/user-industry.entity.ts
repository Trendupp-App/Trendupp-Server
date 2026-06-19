import { Table, Column, DataType, ForeignKey } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';
import { Industry } from './industry.entity';

@Table({ tableName: 'user_industries' })
export class UserIndustry extends BaseEntity<UserIndustry> {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @ForeignKey(() => Industry)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'industry_id',
  })
  declare industryId: string;
}
