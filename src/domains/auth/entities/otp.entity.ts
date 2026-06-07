import { Table, Column, DataType } from 'sequelize-typescript';
import { BaseEntity } from '../../../core/base.entity';

@Table({ tableName: 'otps' })
export class Otp extends BaseEntity<Otp> {
  @Column({ type: DataType.STRING, allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare code: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare type: string; // e.g., 'registration', 'password-reset'

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'otp_expires_at',
  })
  declare otpExpiresAt: Date;
}
