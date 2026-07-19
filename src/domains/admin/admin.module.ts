import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './controllers/admin.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminOverviewController } from './controllers/admin-overview.controller';
import { AdminCreatorsController } from './controllers/admin-creators.controller';
import { RolesSeederService } from './services/roles-seeder.service';
import { AuditLogService } from './services/audit-log.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminOverviewService } from './services/admin-overview.service';
import { AdminCreatorsService } from './services/admin-creators.service';
import { AdminNotesService } from './services/admin-notes.service';
import { AuditLogRepository } from './repository/audit-log.repository';
import { AuditLog } from './entities/audit-log.entity';
import { AdminNote } from './entities/admin-note.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { Niche } from '../users/entities/niche.entity';
import { Nationality } from '../users/entities/nationality.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CampaignApplication } from '../campaigns/entities/campaign-application.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { NewsModule } from '../news/news.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../integration/email/email.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      AuditLog,
      AdminNote,
      Role,
      User,
      Niche,
      Nationality,
      Campaign,
      CampaignApplication,
      Dispute,
    ]),
    ConfigModule,
    CampaignsModule,
    UsersModule,
    NewsModule,
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
    AdminNotesService,
  ],
  controllers: [
    AdminController,
    AdminAuthController,
    AdminUsersController,
    AdminOverviewController,
    AdminCreatorsController,
  ],
  exports: [
    RolesSeederService,
    AuditLogService,
    AdminUsersService,
    AdminOverviewService,
    AdminCreatorsService,
    AdminNotesService,
  ],
})
export class AdminModule {}
