import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './controllers/admin.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminOverviewController } from './controllers/admin-overview.controller';
import { AdminCreatorsController } from './controllers/admin-creators.controller';
import { AdminBrandsController } from './controllers/admin-brands.controller';
import { AdminCampaignsController } from './controllers/admin-campaigns.controller';
import { AdminSocialImpactController } from './controllers/admin-social-impact.controller';
import { RolesSeederService } from './services/roles-seeder.service';
import { AuditLogService } from './services/audit-log.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminOverviewService } from './services/admin-overview.service';
import { AdminCreatorsService } from './services/admin-creators.service';
import { AdminBrandsService } from './services/admin-brands.service';
import { AdminCampaignsService } from './services/admin-campaigns.service';
import { AdminSocialImpactService } from './services/admin-social-impact.service';
import { AdminNotesService } from './services/admin-notes.service';
import { AuditLogRepository } from './repository/audit-log.repository';
import { AuditLog } from './entities/audit-log.entity';
import { AdminNote } from './entities/admin-note.entity';
import { TokenBatch } from './entities/token-batch.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { Niche } from '../users/entities/niche.entity';
import { Industry } from '../users/entities/industry.entity';
import { Nationality } from '../users/entities/nationality.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CreatorCategory } from '../campaigns/entities/creator-category.entity';
import { Platform } from '../campaigns/entities/platform.entity';
import { CampaignApplication } from '../campaigns/entities/campaign-application.entity';
import { ContentSubmission } from '../campaigns/entities/content-submission.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { NewsModule } from '../news/news.module';
import { AdsModule } from '../ads/ads.module';
import { BrandCommissionTier } from './entities/brand-commission-tier.entity';
import { Faq } from './entities/faq.entity';
import { NewsCategory } from './entities/news-category.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { PublicSettingsController } from '../users/controllers/public-settings.controller';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../integration/email/email.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      AuditLog,
      AdminNote,
      TokenBatch,
      Role,
      User,
      Niche,
      Industry,
      Nationality,
      Campaign,
      CreatorCategory,
      Platform,
      CampaignApplication,
      ContentSubmission,
      Dispute,
      BrandCommissionTier,
      Faq,
      NewsCategory,
      SystemSetting,
    ]),
    ConfigModule,
    CampaignsModule,
    UsersModule,
    NewsModule,
    AdsModule,
    AuthModule,
    EmailModule,
  ],
  providers: [
    RolesSeederService,
    AuditLogRepository,
    AuditLogService,
    AdminAuthService,
    AdminUsersService,
    AdminOverviewService,
    AdminCreatorsService,
    AdminBrandsService,
    AdminCampaignsService,
    AdminSocialImpactService,
    AdminNotesService,
    AdminSettingsService,
  ],
  controllers: [
    AdminController,
    AdminAuthController,
    AdminUsersController,
    AdminOverviewController,
    AdminCreatorsController,
    AdminBrandsController,
    AdminCampaignsController,
    AdminSocialImpactController,
    AdminSettingsController,
    PublicSettingsController,
  ],
  exports: [
    RolesSeederService,
    AuditLogService,
    AdminUsersService,
    AdminOverviewService,
    AdminCreatorsService,
    AdminBrandsService,
    AdminCampaignsService,
    AdminSocialImpactService,
    AdminNotesService,
    AdminSettingsService,
    AdsModule,
  ],
})
export class AdminModule {}
