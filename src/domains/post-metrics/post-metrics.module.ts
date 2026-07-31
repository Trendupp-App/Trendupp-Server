import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionPostMedia } from './entities/submission-post-media.entity';
import { PostMetricSnapshot } from './entities/post-metric-snapshot.entity';
import { ContentSubmission } from '../campaigns/entities/content-submission.entity';
import { PostMetricsRepository } from './repository/post-metrics.repository';
import { PostMediaResolverService } from './services/post-media-resolver.service';
import { PostMetricsService } from './services/post-metrics.service';
import { PostMetricsProcessor } from './services/post-metrics.processor';
import { PostMetricsController } from './controllers/post-metrics.controller';
import { AdminPostMetricsController } from './controllers/admin-post-metrics.controller';
import { SocialsModule } from '../socials/socials.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { UsersModule } from '../users/users.module';
import { SocialApisModule } from '../../integration/social-apis/social-apis.module';
import { POST_METRICS_QUEUE } from './post-metrics.constants';

/**
 * Post-campaign performance reporting.
 *
 * Depends on CampaignsModule one-way only: this module reads submissions and
 * campaigns, and the collector discovers new live links by polling rather than
 * campaigns.service pushing to it — so there is no circular import.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([SubmissionPostMedia, PostMetricSnapshot, ContentSubmission]),
    BullModule.registerQueue({ name: POST_METRICS_QUEUE }),
    SocialsModule,
    CampaignsModule,
    SocialApisModule,
    // JwtAuthGuard on both controllers injects UsersService.
    UsersModule,
  ],
  controllers: [PostMetricsController, AdminPostMetricsController],
  providers: [
    PostMetricsRepository,
    PostMediaResolverService,
    PostMetricsService,
    PostMetricsProcessor,
  ],
  exports: [PostMetricsService, PostMetricsRepository],
})
export class PostMetricsModule {}
