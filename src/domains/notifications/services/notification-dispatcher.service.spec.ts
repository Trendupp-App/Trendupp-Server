/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationRepository } from '../repository/notification.repository';
import { EmailService } from '../../../integration/email/email.service';
import { User } from '../../users/entities/user.entity';
import { NOTIFICATION_CATALOG } from '../notification.catalog';
import { CatalogEntry, NotificationType } from '../notification.types';

const defaultSettings = {
  newCampaigns: true,
  applicationUpdates: true,
  paymentAlerts: true,
  brandMessages: true,
  pushNotifications: true,
  emailNotifications: true,
  weeklySummary: false,
  marketingOffers: false,
};

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'creator@example.com',
  firstName: 'Ada',
  lastName: 'Obi',
  notificationSettings: { ...defaultSettings },
  ...overrides,
});

describe('NotificationDispatcherService', () => {
  let service: NotificationDispatcherService;
  let repositoryMock: jest.Mocked<NotificationRepository>;
  let emailServiceMock: jest.Mocked<EmailService>;
  let userModelMock: any;
  let notificationRowMock: any;

  beforeEach(async () => {
    notificationRowMock = { id: 'notif-1', update: jest.fn() };
    repositoryMock = {
      create: jest.fn().mockResolvedValue(notificationRowMock),
    } as unknown as jest.Mocked<NotificationRepository>;
    emailServiceMock = {
      send: jest.fn().mockResolvedValue('sent'),
    } as unknown as jest.Mocked<EmailService>;
    userModelMock = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcherService,
        { provide: NotificationRepository, useValue: repositoryMock },
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://trendupp.com') },
        },
        { provide: getModelToken(User), useValue: userModelMock },
      ],
    }).compile();

    service = module.get(NotificationDispatcherService);
  });

  describe('catalog integrity', () => {
    it('every catalog entry declares category, channels, priority and renderers', () => {
      for (const [type, entry] of Object.entries(NOTIFICATION_CATALOG)) {
        expect(entry.category).toBeDefined();
        expect(entry.channels.length).toBeGreaterThan(0);
        expect(['critical', 'high', 'medium', 'low']).toContain(entry.priority);
        expect(typeof entry.title).toBe('function');
        expect(typeof entry.body).toBe('function');
        expect(type).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
    });
  });

  describe('resolveChannels', () => {
    const entry = (overrides: Partial<CatalogEntry>): CatalogEntry => ({
      category: 'applicationUpdates',
      channels: ['inApp', 'email'],
      priority: 'medium',
      title: () => 't',
      body: () => 'b',
      ...overrides,
    });

    const cases: {
      name: string;
      entry: CatalogEntry;
      settings: Record<string, boolean> | null;
      expected: { inApp: boolean; email: boolean };
    }[] = [
      {
        name: 'defaults: both channels on',
        entry: entry({}),
        settings: { ...defaultSettings },
        expected: { inApp: true, email: true },
      },
      {
        name: 'category off suppresses medium/low entirely',
        entry: entry({ priority: 'medium' }),
        settings: { ...defaultSettings, applicationUpdates: false },
        expected: { inApp: false, email: false },
      },
      {
        name: 'category off still lands critical in-app (no email)',
        entry: entry({ priority: 'critical' }),
        settings: { ...defaultSettings, applicationUpdates: false },
        expected: { inApp: true, email: false },
      },
      {
        name: 'email master toggle off suppresses only email',
        entry: entry({}),
        settings: { ...defaultSettings, emailNotifications: false },
        expected: { inApp: true, email: false },
      },
      {
        name: 'security category bypasses all toggles',
        entry: entry({ category: 'security' }),
        settings: {
          ...defaultSettings,
          applicationUpdates: false,
          paymentAlerts: false,
          emailNotifications: false,
        },
        expected: { inApp: true, email: true },
      },
      {
        name: 'missing settings (pre-migration user) count as enabled',
        entry: entry({}),
        settings: null,
        expected: { inApp: true, email: true },
      },
      {
        name: 'in-app-only entry never emails',
        entry: entry({ channels: ['inApp'] }),
        settings: { ...defaultSettings },
        expected: { inApp: true, email: false },
      },
    ];

    it.each(cases)('$name', ({ entry: catalogEntry, settings, expected }) => {
      const user = { notificationSettings: settings } as unknown as User;
      expect(service.resolveChannels(user, catalogEntry)).toEqual(expected);
    });
  });

  describe('dispatch', () => {
    const input = {
      type: 'application.accepted' as NotificationType,
      recipientId: 'user-1',
      actorId: 'brand-1',
      data: { campaignId: 'c-1', campaignTitle: 'Launch', applicationId: 'a-1' },
    };

    it('inserts an in-app row and sends the email', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);

      await service.dispatch(input);

      expect(repositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          actorId: 'brand-1',
          type: 'application.accepted',
          category: 'applicationUpdates',
        }),
      );
      expect(emailServiceMock.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'creator@example.com', template: 'generic-notification' }),
      );
      expect(notificationRowMock.update).toHaveBeenCalledWith({ emailStatus: 'sent' });
    });

    it('skips the email leg for synthetic social addresses', async () => {
      userModelMock.findAll.mockResolvedValue([
        makeUser({ email: 'tiktok_abc123@trendupp.tiktok' }),
      ]);

      await service.dispatch(input);

      expect(repositoryMock.create).toHaveBeenCalled();
      expect(emailServiceMock.send).not.toHaveBeenCalled();
      expect(notificationRowMock.update).toHaveBeenCalledWith({
        emailStatus: 'skipped',
        emailError: 'synthetic_email',
      });
    });

    it('records an email failure without throwing (in-app row survives)', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);
      emailServiceMock.send.mockRejectedValue(new Error('SES down'));

      await expect(service.dispatch(input as any)).resolves.toBeUndefined();

      expect(notificationRowMock.update).toHaveBeenCalledWith({
        emailStatus: 'failed',
        emailError: 'SES down',
      });
    });

    it('silently no-ops on a duplicate dedupe key (idempotency guard)', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);
      repositoryMock.create.mockRejectedValue(new UniqueConstraintError({}));

      await expect(
        service.dispatch({ ...input, dedupeKey: 'release-1' } as any),
      ).resolves.toBeUndefined();

      expect(emailServiceMock.send).not.toHaveBeenCalled();
    });

    it('never notifies the actor in a multi-recipient fan-out', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser({ id: 'other-user' })]);

      await service.dispatch({
        ...input,
        recipientId: ['user-raiser', 'other-user'],
        actorId: 'user-raiser',
      });

      expect(userModelMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ['other-user'] } }),
      );
    });

    it('stores a per-recipient dedupe key', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);

      await service.dispatch({ ...input, dedupeKey: 'release-1' });

      expect(repositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'application.accepted:release-1:user-1' }),
      );
    });

    it('does nothing for a fully suppressed recipient', async () => {
      userModelMock.findAll.mockResolvedValue([
        makeUser({
          notificationSettings: { ...defaultSettings, applicationUpdates: false },
        }),
      ]);

      // 'campaign.completed' is medium priority in category applicationUpdates
      await service.dispatch({
        type: 'campaign.completed',
        recipientId: 'user-1',
        data: { campaignId: 'c-1', campaignTitle: 'Launch' },
      } as any);

      expect(repositoryMock.create).not.toHaveBeenCalled();
      expect(emailServiceMock.send).not.toHaveBeenCalled();
    });
  });
});
