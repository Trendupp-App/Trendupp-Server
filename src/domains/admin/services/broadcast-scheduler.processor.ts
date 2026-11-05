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
    // The try/catch alone is NOT enough when Redis is unreachable: ioredis
    // parks the command in its offline queue and the promise never settles,
    // which stalls Nest bootstrap before app.listen() — the API looks "down"
    // even though only the queue is. Bound the wait; the scheduler registers
    // in the background whenever Redis comes back.
    const registration = this.queue
      .upsertJobScheduler('broadcast-scheduler', { every: 60_000 })
      .then(() => this.logger.log('Scheduled-broadcast dispatcher registered (every 60s).'))
      .catch((err: Error) =>
        this.logger.error(`Could not register the scheduled-broadcast job: ${err.message}`),
      );

    // The timer must be cleared when registration wins the race — .unref()
    // alone does not cancel it, so it used to log a false "not reachable"
    // error 10s into every successful boot.
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(
          'Redis still connecting 10s into boot — continuing startup; scheduled broadcasts start once it connects.',
        );
        resolve();
      }, 10_000);
      timer.unref();
    });

    await Promise.race([registration, timeout]);
    clearTimeout(timer);
  }

  async process(): Promise<void> {
    await this.adminBroadcastsService.dispatchDueScheduled();
  }
}
