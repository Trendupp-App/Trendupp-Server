import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../core/base.entity';

@Table({ tableName: 'users' })
export class User extends BaseEntity<User> {
  @Column({ type: DataType.STRING, allowNull: false })
  email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  firstName: string;

  @Column({ type: DataType.STRING, allowNull: false })
  lastName: string;

  @Column({ type: DataType.STRING, allowNull: true })
  phoneNumber: string;

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  isActive: boolean;
}
