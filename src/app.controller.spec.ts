import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NOTIFICATIONS_QUEUE } from './domains/notifications/notifications.constants';

describe('AppController', () => {
  let appController: AppController;
  let mockPing: jest.Mock;

  beforeEach(async () => {
    mockPing = jest.fn().mockResolvedValue('PONG');

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getQueueToken(NOTIFICATIONS_QUEUE),
          useValue: { client: Promise.resolve({ ping: mockPing }) },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok with redis up when PING answers', async () => {
      const health = await appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.redis).toBe('up');
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('reports redis down (but still ok) when PING never settles', async () => {
      // Simulate ioredis offline-queueing: the ping promise hangs forever.
      mockPing.mockReturnValue(new Promise(() => {}));
      const health = await appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.redis).toBe('down');
    }, 5000);

    it('reports redis down (but still ok) when PING rejects', async () => {
      mockPing.mockRejectedValue(new Error('connection refused'));
      const health = await appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.redis).toBe('down');
    });
  });
});
