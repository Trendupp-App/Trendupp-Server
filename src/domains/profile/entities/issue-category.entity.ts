import { Table, Column, DataType, HasMany } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { SupportTicket } from './support-ticket.entity';

@Table({ tableName: 'issue_categories' })
export class IssueCategory extends BaseEntity<IssueCategory> {
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare description?: string;

  @HasMany(() => SupportTicket)
  declare supportTickets?: SupportTicket[];
}
