import { Table, Column, DataType, BelongsToMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';
import { UserIndustry } from './user-industry.entity';

@Table({ tableName: 'industries' })
export class Industry extends BaseEntity<Industry> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @BelongsToMany(() => User, () => UserIndustry)
  declare users: User[];
}
