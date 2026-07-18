import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NOTIFICATIONS_QUEUE } from '../notifications.constants';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queueMock: { add: jest.Mock };
  let dispatcherMock: { dispatch: jest.Mock };

  beforeEach(async () => {
    queueMock = { add: jest.fn().mockResolvedValue(undefined) };
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getQueueToken(NOTIFICATIONS_QUEUE), useValue: queueMock },
        { provide: NotificationDispatcherService, useValue: dispatcherMock },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  const input = {
    type: 'payout.released' as const,
    recipientId: 'creator-1',
    data: { campaignId: 'c-1', campaignTitle: 'Launch', releaseId: 'r-1', amount: 50000 },
    dedupeKey: 'r-1',
  };

  it('enqueues a dispatch job with the dedupe-derived jobId', async () => {
    await service.notify(input);

    expect(queueMock.add).toHaveBeenCalledWith(
      'dispatch',
      input,
      expect.objectContaining({ jobId: 'payout.released:r-1', attempts: 3 }),
    );
    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();
  });

  it('enqueues without a jobId when no dedupeKey is given', async () => {
    const noDedupe = { ...input, dedupeKey: undefined };
    await service.notify(noDedupe);

    expect(queueMock.add).toHaveBeenCalledWith(
      'dispatch',
      noDedupe,
      expect.objectContaining({ jobId: undefined }),
    );
  });

  it('falls back to inline dispatch when the queue is unreachable — and never throws', async () => {
    queueMock.add.mockRejectedValue(new Error('Redis down'));

    await expect(service.notify(input)).resolves.toBeUndefined();
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(input);
  });

  it('never throws even when both the queue and the inline fallback fail', async () => {
    queueMock.add.mockRejectedValue(new Error('Redis down'));
    dispatcherMock.dispatch.mockRejectedValue(new Error('DB down'));

    await expect(service.notify(input)).resolves.toBeUndefined();
  });

  it('drops an unknown type without enqueueing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await service.notify({ ...input, type: 'nonsense.type' } as any);

    expect(queueMock.add).not.toHaveBeenCalled();
    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();
  });

  it('drops a call with no recipients without enqueueing', async () => {
    await service.notify({ type: input.type, data: input.data });

    expect(queueMock.add).not.toHaveBeenCalled();
  });
});
