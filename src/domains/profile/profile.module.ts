import { Module } from '@nestjs/common';
import { OnboardingController } from './controllers/onboarding.controller';
import { OnboardingService } from './services/onboarding.service';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { UsersModule } from '../users/users.module';
import { S3Service } from '../../integration/s3/s3.service';

@Module({
  imports: [UsersModule],
  controllers: [OnboardingController, ProfileController],
  providers: [OnboardingService, ProfileService, S3Service],
  exports: [OnboardingService, ProfileService],
})
export class ProfileModule {}
