import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AdminBroadcastsService } from './admin-broadcasts.service';

export const BROADCASTS_QUEUE = 'broadcasts';

/**
 * Minute tick that sends due `status: 'scheduled'` broadcasts.
 *
 * A BullMQ repeatable job (NOT @Cron): @Cron fires on every PM2 instance
 * (`instances: 'max'`), while a repeatable job is enqueued once (identical
 * repeat specs from N instances dedupe in Redis) and each tick is consumed by
 * exactly one worker. Per-broadcast claiming in dispatchDueScheduled() adds a
 * second guard against racing a manual send.
 */
@Processor(BROADCASTS_QUEUE, { concurrency: 1 })
export class BroadcastSchedulerProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BroadcastSchedulerProcessor.name);

  constructor(
    @InjectQueue(BROADCASTS_QUEUE)
    private readonly queue: Queue,
    private readonly adminBroadcastsService: AdminBroadcastsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler('broadcast-scheduler', { every: 60_000 });
      this.logger.log('Scheduled-broadcast dispatcher registered (every 60s).');
    } catch (err) {
      // Redis down at boot: broadcasts pause, the app must still start.
      this.logger.error(
        `Could not register the scheduled-broadcast job: ${(err as Error).message}`,
      );
    }
  }

  async process(): Promise<void> {
    await this.adminBroadcastsService.dispatchDueScheduled();
  }
}
