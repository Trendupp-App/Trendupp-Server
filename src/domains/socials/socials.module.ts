import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SocialConnection } from './entities/social-connection.entity';
import { SocialPlatformSetting } from './entities/social-platform-setting.entity';
import { SocialConnectionRepository } from './repository/social-connection.repository';
import { SocialPlatformSettingRepository } from './repository/social-platform-setting.repository';
import { SocialVerificationService } from './services/social-verification.service';
import { SocialsService } from './services/socials.service';
import { SocialsController } from './controllers/socials.controller';
import { UsersModule } from '../users/users.module';
import { SocialApisModule } from '../../integration/social-apis/social-apis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SequelizeModule.forFeature([SocialConnection, SocialPlatformSetting]),
    UsersModule,
    SocialApisModule,
    NotificationsModule,
  ],
  providers: [
    SocialConnectionRepository,
    SocialPlatformSettingRepository,
    SocialVerificationService,
    SocialsService,
  ],
  controllers: [SocialsController],
  exports: [SocialsService],
})
export class SocialsModule {}
