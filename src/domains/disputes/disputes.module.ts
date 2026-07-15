import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Dispute } from './entities/dispute.entity';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { StreamModule } from '../../integration/stream/stream.module';
import { DisputesController } from './controllers/disputes.controller';
import { DisputesService } from './services/disputes.service';
import { DisputeRepository } from './repository/dispute.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Dispute]),
    CampaignsModule,
    UsersModule,
    StreamModule,
    NotificationsModule,
  ],
  controllers: [DisputesController],
  providers: [DisputeRepository, DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
