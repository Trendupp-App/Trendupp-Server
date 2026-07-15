import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';
import { User } from '../../users/entities/user.entity';

@Table({ tableName: 'notifications' })
export class Notification extends BaseEntity<Notification> {
  /** Recipient */
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  declare userId: string;

  @BelongsTo(() => User, 'user_id')
  declare user: User;

  /** Who triggered the event (brand accepting, admin resolving, ...) */
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: true, field: 'actor_id' })
  declare actorId?: string | null;

  @BelongsTo(() => User, 'actor_id')
  declare actor?: User;

  /** Catalog key, e.g. 'payout.released' */
  @Column({ type: DataType.STRING(64), allowNull: false })
  declare type: string;

  /** Preference category it was gated on ('paymentAlerts', ... or 'security') */
  @Column({ type: DataType.STRING(32), allowNull: false })
  declare category: string;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'medium' })
  declare priority: string; // 'critical' | 'high' | 'medium' | 'low'

  /** Pre-rendered at dispatch time so the feed never re-renders */
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string;

  /** Client deep-link path */
  @Column({ type: DataType.STRING(500), allowNull: true, field: 'action_url' })
  declare actionUrl?: string | null;

  /** Raw payload for client deep-linking / future re-rendering */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  declare data: object;

  /** Badge cleared (tray opened) — distinct from the item being opened */
  @Column({ type: DataType.DATE, allowNull: true, field: 'seen_at' })
  declare seenAt?: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'read_at' })
  declare readAt?: Date | null;

  /** Audit of the email leg: 'skipped' | 'sent' | 'mocked' | 'failed' */
  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'skipped',
    field: 'email_status',
  })
  declare emailStatus: string;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'email_error' })
  declare emailError?: string | null;

  /**
   * Per-recipient idempotency key: `<type>:<dedupeKey>:<userId>`.
   * Unique-indexed (partial, WHERE dedupe_key IS NOT NULL) so cron double-fires
   * across PM2 instances and webhook redeliveries silently no-op.
   */
  @Column({ type: DataType.STRING(255), allowNull: true, field: 'dedupe_key' })
  declare dedupeKey?: string | null;
}
