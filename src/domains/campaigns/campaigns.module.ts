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
import { Payment } from './entities/payment.entity';
import { CampaignApplication } from './entities/campaign-application.entity';
import { ContentSubmission } from './entities/content-submission.entity';
import { Fee } from './entities/fee.entity';
import { CampaignReview } from './entities/campaign-review.entity';
import { PaymentRelease } from './entities/payment-release.entity';
import { CampaignRefund } from './entities/campaign-refund.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Niche } from '../users/entities/niche.entity';
import { PandascrowModule } from '../../integration/payment-gateway/pandascrow.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../../integration/email/email.module';

import { WebhooksController } from './controllers/webhooks.controller';
import { PayoutScheduler } from './services/payout.scheduler';
import { TimelineService } from './services/timeline.service';
import { CampaignTimelineScheduler } from './services/campaign-timeline.scheduler';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Campaign,
      CreatorCategory,
      Platform,
      CampaignPlatform,
      Payment,
      CampaignApplication,
      ContentSubmission,
      Fee,
      CampaignReview,
      PaymentRelease,
      CampaignRefund,
      Dispute,
      Niche,
    ]),
    UsersModule,

    PandascrowModule,
    NotificationsModule,
    EmailModule,
  ],

  providers: [
    CampaignRepository,
    CampaignsService,
    S3Service,
    PayoutScheduler,
    TimelineService,
    CampaignTimelineScheduler,
  ],
  controllers: [CampaignsController, WebhooksController],
  exports: [CampaignsService, CampaignRepository, SequelizeModule, TimelineService],
})
export class CampaignsModule {}
