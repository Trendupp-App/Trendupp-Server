import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [CampaignsModule, UsersModule],
  controllers: [AdminController],
})
export class AdminModule {}
