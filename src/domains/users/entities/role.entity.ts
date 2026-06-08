import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';

@Table({ tableName: 'roles' })
export class Role extends BaseEntity<Role> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, field: 'display_name' })
  declare displayName: string;

  @HasMany(() => User)
  declare users: User[];
}
