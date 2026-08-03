import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from './domains/notifications/notifications.constants';

export interface HealthReport {
  status: 'ok';
  /**
   * Informational ONLY — never flips the HTTP status. Redis powers background
   * queues (notifications, scheduled broadcasts, post-metrics); the API is
   * designed to run degraded without it, and the deploy pipeline's health
   * gate must not fail (and roll back) over a paused queue.
   */
  redis: 'up' | 'down';
  uptimeSeconds: number;
}

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {}

  getHomeInfo() {
    return {
      name: 'Trendupp API',
      description: 'The Trendupp Social Commerce Backend API v1.0',
      docs: '/docs',
      status: 'healthy',
      author: 'The prodCycle Engineering Team',
    };
  }

  async getHealth(): Promise<HealthReport> {
    return {
      status: 'ok',
      redis: (await this.pingRedis()) ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * Bounded probe. `queue.client` (and PING) never settle while ioredis is
   * offline-queueing, so an unraced await here would hang the health endpoint
   * — the exact failure mode this report exists to expose.
   */
  private async pingRedis(): Promise<boolean> {
    try {
      // BullMQ types the client as IRedisClient, which omits ping() even
      // though both ioredis Redis and Cluster implement it.
      const ping = this.notificationsQueue.client.then((client) =>
        (client as unknown as { ping: () => Promise<string> }).ping(),
      );
      const result = await Promise.race([
        ping,
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 1_000).unref()),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
