import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from '../notifications.constants';
import { NOTIFICATION_CATALOG } from '../notification.catalog';
import { NotificationType, NotifyInput } from '../notification.types';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/**
 * The single producer API for the notification system.
 *
 * Usage from any domain service (import NotificationsModule, inject this):
 *
 *   await this.notificationsService.notify({
 *     type: 'payout.released',
 *     recipientId: release.creatorId,
 *     data: { amount, campaignId, campaignTitle, releaseId },
 *     dedupeKey: release.id,   // REQUIRED from crons/webhooks
 *   });
 *
 * notify() NEVER throws — a Redis outage or a bad payload must never break
 * the business transaction that triggered it (an escrow webhook, a payout
 * run). Failures are logged; when the queue is unreachable the notification
 * is dispatched inline as a best-effort fallback.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async notify<T extends NotificationType>(input: NotifyInput<T>): Promise<void> {
    try {
      if (!NOTIFICATION_CATALOG[input.type]) {
        this.logger.error(`notify() called with unknown type "${input.type}" — dropping.`);
        return;
      }
      if (!input.recipientId && !input.recipientRole) {
        this.logger.error(`notify("${input.type}") called without recipientId or recipientRole.`);
        return;
      }

      const enqueue = this.queue.add('dispatch', input, {
        // dedupeKey → jobId: N PM2 instances enqueueing the same cron-origin
        // event collapse into one job while it lives in the queue. The DB
        // unique index on notifications.dedupe_key is the authoritative guard.
        jobId: input.dedupeKey ? `${input.type}:${input.dedupeKey}` : undefined,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });

      // With Redis unreachable, ioredis parks add() in its offline queue and
      // the promise NEVER settles — so without this bound the catch below
      // (the inline-dispatch fallback) can never fire in production, and the
      // request handler awaiting notify() hangs with it. Racing a rejection
      // restores the fallback. Edge case: if Redis recovers moments after
      // the timeout, the parked job may still deliver alongside the inline
      // dispatch — for dedupeKey'd types the DB unique index collapses the
      // pair; for the rest a rare duplicate beats a hung user request.
      await Promise.race([
        enqueue,
        new Promise((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error('queue.add() timed out after 3s — Redis likely unreachable')),
            3_000,
          );
          // Don't hold the event loop open for the timer; also silence the
          // eventual settlement of the losing promise.
          timer.unref();
          enqueue.then(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
        }),
      ]);
    } catch (queueError: unknown) {
      const message = queueError instanceof Error ? queueError.message : String(queueError);
      this.logger.warn(
        `Notification queue unavailable (${message}) — dispatching "${input.type}" inline.`,
      );
      // Fire-and-forget: the caller's transaction must not wait on (or fail
      // with) the fallback delivery.
      this.dispatcher.dispatch(input as NotifyInput).catch((dispatchError: unknown) => {
        const msg = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
        this.logger.error(`Inline notification dispatch failed for "${input.type}": ${msg}`);
      });
    }
  }
}
