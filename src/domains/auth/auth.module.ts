import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Otp } from './entities/otp.entity';
import { OtpRepository } from './repository/otp.repository';
import { OtpService } from './services/otp.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { EmailService } from '../../integration/email/email.service';

@Module({
  imports: [SequelizeModule.forFeature([Otp])],
  providers: [OtpRepository, OtpService, AuthService, EmailService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
