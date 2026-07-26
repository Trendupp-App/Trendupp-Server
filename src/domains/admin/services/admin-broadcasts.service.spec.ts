import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AdminBroadcastsService } from './admin-broadcasts.service';
import { BroadcastRepository } from '../../notifications/repository/broadcast.repository';
import { NotificationRepository } from '../../notifications/repository/notification.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { DeviceTokenRepository } from '../../notifications/repository/device-token.repository';
import { PushService } from '../../../integration/push/push.service';
import { EmailService } from '../../../integration/email/email.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Broadcast } from '../../notifications/entities/broadcast.entity';

describe('AdminBroadcastsService', () => {
  let service: AdminBroadcastsService;
  let broadcastRepoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findPendingScheduled: jest.Mock;
    claimScheduled: jest.Mock;
  };
  let notificationRepoMock: { create: jest.Mock };
  let pushServiceMock: { isConfigured: boolean; sendToTokens: jest.Mock };
  let emailServiceMock: { send: jest.Mock };
  let userModelMock: { findAll: jest.Mock };
  let roleModelMock: { findAll: jest.Mock };

  const mockBroadcast = {
    id: 'bc-1',
    title: 'Platform Maintenance Notice',
    message: 'We will perform scheduled maintenance on June 4th...',
    audience: 'all',
    channel: 'in_app',
    status: 'draft',
    createdById: 'admin-1',
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as Broadcast;

  beforeEach(async () => {
    broadcastRepoMock = {
      create: jest.fn().mockResolvedValue(mockBroadcast),
      findById: jest.fn().mockResolvedValue(mockBroadcast),
      findAll: jest.fn().mockResolvedValue({
        data: [mockBroadcast],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      }),
      update: jest.fn().mockResolvedValue([1, [mockBroadcast]]),
      delete: jest.fn().mockResolvedValue(1),
      findPendingScheduled: jest.fn().mockResolvedValue([]),
      claimScheduled: jest.fn().mockResolvedValue(true),
    };

    notificationRepoMock = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    emailServiceMock = {
      send: jest.fn().mockResolvedValue('sent'),
    };

    pushServiceMock = {
      isConfigured: true,
      sendToTokens: jest.fn().mockResolvedValue({ sent: 2, failed: 0, invalidTokens: [] }),
    };

    userModelMock = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'user-1', email: 'creator@test.com', firstName: 'Creator' },
        { id: 'user-2', email: 'brand@test.com', firstName: 'Brand' },
      ]),
    };

    roleModelMock = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'r1', name: 'creator' },
        { id: 'r2', name: 'brand' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBroadcastsService,
        { provide: BroadcastRepository, useValue: broadcastRepoMock },
        { provide: NotificationRepository, useValue: notificationRepoMock },
        {
          provide: NotificationsService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: DeviceTokenRepository,
          useValue: {
            findTokensForUsers: jest.fn().mockResolvedValue(['fcm-1', 'fcm-2']),
            removeTokens: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: PushService, useValue: pushServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: getModelToken(User), useValue: userModelMock },
        { provide: getModelToken(Role), useValue: roleModelMock },
      ],
    }).compile();

    service = module.get<AdminBroadcastsService>(AdminBroadcastsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBroadcast', () => {
    it('should create a draft broadcast successfully', async () => {
      const result = await service.createBroadcast('admin-1', {
        title: 'Platform Maintenance Notice',
        message: 'We will perform scheduled maintenance on June 4th...',
        audience: 'all',
        channel: 'in_app',
        status: 'draft',
      });

      expect(broadcastRepoMock.create).toHaveBeenCalledWith({
        title: 'Platform Maintenance Notice',
        message: 'We will perform scheduled maintenance on June 4th...',
        audience: 'all',
        channel: 'in_app',
        status: 'draft',
        scheduledAt: null,
        createdById: 'admin-1',
      });
      expect(result).toEqual(mockBroadcast);
    });

    it('should throw BadRequestException if scheduled broadcast has no scheduledAt', async () => {
      await expect(
        service.createBroadcast('admin-1', {
          title: 'Scheduled Broadcast',
          message: 'Message',
          audience: 'creators',
          channel: 'both',
          status: 'scheduled',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if scheduledAt date is in the past', async () => {
      const pastDate = new Date(Date.now() - 100000).toISOString();
      await expect(
        service.createBroadcast('admin-1', {
          title: 'Scheduled Broadcast',
          message: 'Message',
          audience: 'creators',
          channel: 'both',
          status: 'scheduled',
          scheduledAt: pastDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBroadcastsList', () => {
    it('should query broadcast repository with pagination and filters', async () => {
      const query = { page: 1, limit: 10, tab: 'all', audience: 'creators', q: 'maintenance' };
      const result = await service.getBroadcastsList(query);

      expect(broadcastRepoMock.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        tab: 'all',
        audience: 'creators',
        q: 'maintenance',
      });
      expect(result.data.length).toBe(1);
    });
  });

  describe('getBroadcastById', () => {
    it('should return a broadcast when found', async () => {
      const result = await service.getBroadcastById('bc-1');
      expect(result).toEqual(mockBroadcast);
    });

    it('should throw NotFoundException when broadcast is missing', async () => {
      broadcastRepoMock.findById.mockResolvedValue(null);
      await expect(service.getBroadcastById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBroadcast', () => {
    it('should update draft fields successfully', async () => {
      const result = await service.updateBroadcast('bc-1', {
        title: 'Updated Title',
      });

      expect(broadcastRepoMock.update).toHaveBeenCalledWith('bc-1', {
        title: 'Updated Title',
      });
      expect(result).toEqual(mockBroadcast);
    });

    it('should throw ForbiddenException when modifying a broadcast already sent', async () => {
      broadcastRepoMock.findById.mockResolvedValue({
        ...mockBroadcast,
        status: 'sent',
      });

      await expect(
        service.updateBroadcast('bc-1', {
          title: 'Updated Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteBroadcast', () => {
    it('should soft delete a draft or scheduled broadcast', async () => {
      const result = await service.deleteBroadcast('bc-1');
      expect(broadcastRepoMock.delete).toHaveBeenCalledWith('bc-1');
      expect(result).toEqual({ message: 'Broadcast deleted successfully' });
    });
  });

  describe('dispatchBroadcast', () => {
    it('should resolve target users and bulk insert in-app notifications and send emails', async () => {
      const sentBroadcast = {
        ...mockBroadcast,
        audience: 'all',
        channel: 'both',
      } as Broadcast;
      broadcastRepoMock.findById.mockResolvedValue(sentBroadcast);

      await service.dispatchBroadcast('bc-1');

      expect(userModelMock.findAll).toHaveBeenCalled();
      expect(notificationRepoMock.create).toHaveBeenCalledTimes(2);
      expect(emailServiceMock.send).toHaveBeenCalledTimes(2);
    });

    it('in_app broadcasts also push to every recipient device (in_app = in-app + push)', async () => {
      broadcastRepoMock.findById.mockResolvedValue({
        ...mockBroadcast,
        channel: 'in_app',
      });
      await service.dispatchBroadcast('bc-1');

      expect(pushServiceMock.sendToTokens).toHaveBeenCalledWith(
        ['fcm-1', 'fcm-2'],
        expect.objectContaining({ title: mockBroadcast.title, body: mockBroadcast.message }),
      );
      expect(emailServiceMock.send).not.toHaveBeenCalled();
    });
  });

  describe('dispatchDueScheduled', () => {
    const dueBroadcast = {
      ...mockBroadcast,
      id: 'bc-due',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() - 60_000),
    } as unknown as Broadcast;

    it('claims and dispatches every due scheduled broadcast', async () => {
      broadcastRepoMock.findPendingScheduled.mockResolvedValue([dueBroadcast]);
      broadcastRepoMock.findById.mockResolvedValue({
        ...dueBroadcast,
        channel: 'in_app',
      });

      const dispatched = await service.dispatchDueScheduled();

      expect(broadcastRepoMock.claimScheduled).toHaveBeenCalledWith('bc-due');
      expect(dispatched).toBe(1);
      expect(notificationRepoMock.create).toHaveBeenCalled();
    });

    it('skips a broadcast another worker (or a manual send) already claimed', async () => {
      broadcastRepoMock.findPendingScheduled.mockResolvedValue([dueBroadcast]);
      broadcastRepoMock.claimScheduled.mockResolvedValue(false);

      const dispatched = await service.dispatchDueScheduled();

      expect(dispatched).toBe(0);
      expect(notificationRepoMock.create).not.toHaveBeenCalled();
    });

    it('marks a broadcast failed when dispatch throws, without breaking the batch', async () => {
      broadcastRepoMock.findPendingScheduled.mockResolvedValue([dueBroadcast]);
      userModelMock.findAll.mockRejectedValue(new Error('db down'));

      const dispatched = await service.dispatchDueScheduled();

      expect(dispatched).toBe(0);
      expect(broadcastRepoMock.update).toHaveBeenCalledWith('bc-due', { status: 'failed' });
    });

    it('does nothing when no scheduled broadcast is due', async () => {
      broadcastRepoMock.findPendingScheduled.mockResolvedValue([]);

      const dispatched = await service.dispatchDueScheduled();

      expect(dispatched).toBe(0);
      expect(broadcastRepoMock.claimScheduled).not.toHaveBeenCalled();
    });
  });
});
