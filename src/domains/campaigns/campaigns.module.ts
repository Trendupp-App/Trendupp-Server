import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Campaign } from './entities/campaign.entity';
import { CreatorCategory } from './entities/creator-category.entity';
import { Platform } from './entities/platform.entity';
import { CampaignPlatform } from './entities/campaign-platform.entity';
import { CampaignRepository } from './repository/campaign.repository';
import { CampaignsService } from './services/campaigns.service';
import { CampaignsController } from './controllers/campaigns.controller';
import { UsersModule } from '../users/users.module';
import { S3Service } from '../../integration/s3/s3.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Campaign, CreatorCategory, Platform, CampaignPlatform]),
    UsersModule,
  ],
  providers: [CampaignRepository, CampaignsService, S3Service],
  controllers: [CampaignsController],
  exports: [CampaignsService, CampaignRepository, SequelizeModule],
})
export class CampaignsModule {}
