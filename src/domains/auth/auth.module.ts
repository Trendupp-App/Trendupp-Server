import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Otp } from './entities/otp.entity';
import { AppleNameCache } from './entities/apple-name-cache.entity';
import { AuthProviderSetting } from './entities/auth-provider-setting.entity';
import { OtpRepository } from './repository/otp.repository';
import { OtpService } from './services/otp.service';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { EmailService } from '../../integration/email/email.service';
import { UsersModule } from '../users/users.module';
import { SocialApisModule } from '../../integration/social-apis/social-apis.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Otp, AppleNameCache, AuthProviderSetting]),
    UsersModule,
    SocialApisModule,
  ],
  providers: [OtpRepository, OtpService, AuthService, EmailService],
  controllers: [AuthController],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
