import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { State } from './state.entity';

@Table({ tableName: 'nationalities' })
export class Nationality extends BaseEntity<Nationality> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'USD' })
  declare currency: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_african' })
  declare isAfrican: boolean;

  @HasMany(() => State)
  declare states: State[];
}
