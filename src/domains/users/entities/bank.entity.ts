import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'banks' })
export class Bank extends BaseEntity<Bank> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare code: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare country: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare region: string;
}
