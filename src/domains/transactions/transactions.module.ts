import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PaymentRelease } from '../campaigns/entities/payment-release.entity';
import { Payment } from '../campaigns/entities/payment.entity';
import { CampaignRefund } from '../campaigns/entities/campaign-refund.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { UsersModule } from '../users/users.module';
import { TransactionsRepository } from './repository/transactions.repository';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([PaymentRelease, Payment, CampaignRefund, Campaign, Dispute]),
    UsersModule,
  ],
  providers: [TransactionsRepository, TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
