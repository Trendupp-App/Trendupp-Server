import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from '../notifications.constants';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotifyInput } from '../notification.types';

/**
 * First (and currently only) BullMQ worker in the codebase — consumes the
 * 'notifications' queue off the root Redis connection (app.module.ts).
 *
 * BullMQ workers take distributed locks in Redis, so running one worker per
 * PM2 cluster instance is safe: each job is processed exactly once, unlike
 * @Cron which fires on every instance.
 */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDispatchProcessor.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {
    super();
  }

  async process(job: Job<NotifyInput>): Promise<void> {
    this.logger.debug(`Dispatching notification job ${job.id} (${job.data.type})`);
    await this.dispatcher.dispatch(job.data);
  }
}
