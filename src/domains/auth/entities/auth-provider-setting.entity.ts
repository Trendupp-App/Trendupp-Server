import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

/**
 * Runtime kill-switch per OAuth provider. Flip rows directly in the DB (or
 * via a future admin endpoint) — no deploy needed:
 *
 *   signinEnabled=false, signupEnabled=false → provider fully off
 *   signinEnabled=true,  signupEnabled=false → existing users only
 *
 * Providers without a row are treated as fully enabled (fail-open, so a
 * missed seed can never lock everyone out of the platform).
 */
@Table({ tableName: 'auth_provider_settings' })
export class AuthProviderSetting extends BaseEntity<AuthProviderSetting> {
  @Column({ type: DataType.STRING(16), allowNull: false, unique: true })
  declare provider: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'signin_enabled' })
  declare signinEnabled: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'signup_enabled' })
  declare signupEnabled: boolean;
}
