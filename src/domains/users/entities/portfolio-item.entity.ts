import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from './user.entity';

@Table({ tableName: 'portfolio_items', paranoid: true })
export class PortfolioItem extends BaseEntity<PortfolioItem> {
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => User)
  declare user?: User;

  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare link?: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'cover_image' })
  declare coverImage?: string;
}
