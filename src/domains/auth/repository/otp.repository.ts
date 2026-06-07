import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Otp } from '../entities/otp.entity';

@Injectable()
export class OtpRepository {
  constructor(
    @InjectModel(Otp)
    private readonly otpModel: typeof Otp,
  ) {}

  async deleteByEmailAndType(email: string, type: string): Promise<void> {
    await this.otpModel.destroy({
      where: { email, type },
      force: true,
    });
  }

  async create(data: {
    email: string;
    code: string;
    type: string;
    otpExpiresAt: Date;
  }): Promise<Otp> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.otpModel as any).create(data) as Promise<Otp>;
  }

  async findByEmailAndCode(email: string, code: string): Promise<Otp | null> {
    return this.otpModel.findOne({
      where: { email, code },
      order: [['createdAt', 'DESC']],
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.otpModel.destroy({
      where: { id },
      force: true,
    });
  }
}
