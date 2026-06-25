import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SocialConnection } from './entities/social-connection.entity';
import { SocialConnectionRepository } from './repository/social-connection.repository';
import { SocialVerificationService } from './services/social-verification.service';
import { SocialsService } from './services/socials.service';
import { SocialsController } from './controllers/socials.controller';
import { UsersModule } from '../users/users.module';
import { SocialApisModule } from '../../integration/social-apis/social-apis.module';

@Module({
  imports: [SequelizeModule.forFeature([SocialConnection]), UsersModule, SocialApisModule],
  providers: [SocialConnectionRepository, SocialVerificationService, SocialsService],
  controllers: [SocialsController],
  exports: [SocialsService],
})
export class SocialsModule {}
