import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { POST_METRICS_QUEUE, CAPTURE_WINDOWS } from '../post-metrics.constants';
import { PostMediaResolverService } from './post-media-resolver.service';
import { PostMetricsService } from './post-metrics.service';
import { PostMetricsRepository } from '../repository/post-metrics.repository';

/** How often the tick runs. Capture windows are days apart; 15 min is ample. */
const TICK_INTERVAL_MS = 15 * 60 * 1000;

/** Work ceiling per tick so one backlog cannot monopolise the worker. */
const RESOLVE_BATCH = 25;
const CAPTURE_BATCH = 50;

/**
 * Drives post-metric collection.
 *
 * A BullMQ repeatable job rather than @Cron: @Cron fires on every PM2
 * instance (`instances: 'max'`), whereas identical repeat specs from N
 * instances dedupe in Redis and each tick is consumed by exactly one worker.
 * Same reasoning as BroadcastSchedulerProcessor.
 */
@Processor(POST_METRICS_QUEUE, { concurrency: 1 })
export class PostMetricsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PostMetricsProcessor.name);

  constructor(
    @InjectQueue(POST_METRICS_QUEUE)
    private readonly queue: Queue,
    private readonly repository: PostMetricsRepository,
    private readonly resolver: PostMediaResolverService,
    private readonly metrics: PostMetricsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Same bounded wait as BroadcastSchedulerProcessor: with Redis down,
    // ioredis never settles this promise (offline queue), and an unbounded
    // await here stalls Nest bootstrap before app.listen().
    const registration = this.queue
      .upsertJobScheduler('post-metrics-tick', { every: TICK_INTERVAL_MS })
      .then(() =>
        this.logger.log(
          `Post-metrics collector registered (every ${TICK_INTERVAL_MS / 60_000} min).`,
        ),
      )
      .catch((err: Error) =>
        this.logger.error(`Could not register the post-metrics job: ${err.message}`),
      );

    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        this.logger.error(
          'Redis not reachable within 10s at boot — continuing startup; metric collection resumes when it reconnects.',
        );
        resolve();
      }, 10_000).unref(),
    );

    await Promise.race([registration, timeout]);
  }

  async process(): Promise<void> {
    await this.registerNewLiveLinks();
    await this.resolvePending();
    await this.captureDue();
  }

  /**
   * Pick up live links submitted since the last tick. Pulling rather than
   * having campaigns.service push keeps the modules independent, and means
   * links submitted before this feature shipped get picked up too.
   */
  private async registerNewLiveLinks(): Promise<void> {
    const submissions = await this.repository.findSubmissionsNeedingRegistration(RESOLVE_BATCH);
    if (submissions.length === 0) return;

    for (const submission of submissions) {
      if (!submission.liveLink) continue;
      await this.resolver.registerSubmission({
        submissionId: submission.id,
        campaignId: submission.campaignId,
        creatorId: submission.creatorId,
        liveLink: submission.liveLink,
      });
    }
    this.logger.log(`Registered live posts for ${submissions.length} submission(s).`);
  }

  /** Turn newly submitted live links into verified platform media ids. */
  private async resolvePending(): Promise<void> {
    const pending = await this.repository.findPendingResolution(RESOLVE_BATCH);
    if (pending.length === 0) return;

    this.logger.log(`Resolving ${pending.length} pending live post(s).`);
    for (const media of pending) {
      // resolve() never throws — it records the outcome as a status.
      await this.resolver.resolve(media.id);
    }
  }

  /**
   * Capture every window that has come due. The candidate query is bounded to
   * posts published inside the longest window plus a grace period, so old
   * media is not rescanned forever.
   */
  private async captureDue(): Promise<void> {
    const longestWindowMs = Math.max(...CAPTURE_WINDOWS.map((w) => w.offsetMs));
    const graceMs = 7 * 24 * 60 * 60 * 1000;
    const oldestPublishedAfter = new Date(Date.now() - longestWindowMs - graceMs);

    const candidates = await this.repository.findCaptureCandidates(
      oldestPublishedAfter,
      CAPTURE_BATCH,
    );

    let captured = 0;
    for (const media of candidates) {
      for (const windowLabel of this.metrics.dueWindows(media)) {
        const snapshot = await this.metrics.captureSnapshot(media.id, windowLabel);
        if (snapshot) captured += 1;
      }
    }

    if (captured > 0) this.logger.log(`Captured ${captured} post metric snapshot(s).`);
  }
}
