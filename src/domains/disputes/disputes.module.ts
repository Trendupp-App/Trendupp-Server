import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Dispute } from './entities/dispute.entity';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { StreamModule } from '../../integration/stream/stream.module';
import { DisputesController } from './controllers/disputes.controller';
import { DisputesService } from './services/disputes.service';
import { DisputeRepository } from './repository/dispute.repository';

@Module({
  imports: [SequelizeModule.forFeature([Dispute]), CampaignsModule, UsersModule, StreamModule],
  controllers: [DisputesController],
  providers: [DisputeRepository, DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
