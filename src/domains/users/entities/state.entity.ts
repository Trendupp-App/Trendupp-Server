import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { Nationality } from './nationality.entity';

@Table({ tableName: 'states' })
export class State extends BaseEntity<State> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @ForeignKey(() => Nationality)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'nationality_id',
  })
  declare nationalityId: string;

  @BelongsTo(() => Nationality)
  declare nationality: Nationality;
}
