import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [CampaignsModule, UsersModule, NewsModule],
  controllers: [AdminController],
})
export class AdminModule {}
