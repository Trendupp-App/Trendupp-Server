import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

/**
 * Backup store for Sign in with Apple names — see the migration for the full
 * rationale. One row per Apple user id; written whenever an Apple auth
 * attempt carries the (first-authorization-only) name, consumed and deleted
 * when the account is created or healed.
 */
@Table({ tableName: 'apple_name_cache' })
export class AppleNameCache extends BaseEntity<AppleNameCache> {
  @Column({ type: DataType.STRING, allowNull: false, unique: true, field: 'apple_user_id' })
  declare appleUserId: string;

  @Column({ type: DataType.STRING, allowNull: true })
  declare email?: string | null;

  @Column({ type: DataType.STRING, allowNull: false, field: 'first_name' })
  declare firstName: string;

  @Column({ type: DataType.STRING, allowNull: true, field: 'last_name' })
  declare lastName?: string | null;
}
