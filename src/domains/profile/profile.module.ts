import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { OnboardingController } from './controllers/onboarding.controller';
import { OnboardingService } from './services/onboarding.service';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';
import { UsersModule } from '../users/users.module';
import { S3Service } from '../../integration/s3/s3.service';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportTicketRepository } from './repository/support-ticket.repository';
import { IssueCategory } from './entities/issue-category.entity';
import { IssueCategoryRepository } from './repository/issue-category.repository';

@Module({
  imports: [UsersModule, SequelizeModule.forFeature([SupportTicket, IssueCategory])],
  controllers: [OnboardingController, ProfileController],
  providers: [
    OnboardingService,
    ProfileService,
    S3Service,
    SupportTicketRepository,
    IssueCategoryRepository,
  ],
  exports: [OnboardingService, ProfileService],
})
export class ProfileModule {}
