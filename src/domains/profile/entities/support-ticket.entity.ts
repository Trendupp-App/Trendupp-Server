import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';
import { IssueCategory } from './issue-category.entity';

@Table({ tableName: 'support_tickets' })
export class SupportTicket extends BaseEntity<SupportTicket> {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  userId: string;

  @ForeignKey(() => IssueCategory)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'issue_category_id',
  })
  issueCategoryId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  subject: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  description: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'attachment_url',
  })
  attachmentUrl: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    defaultValue: 'open',
  })
  status: string;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => IssueCategory)
  issueCategory: IssueCategory;
}
