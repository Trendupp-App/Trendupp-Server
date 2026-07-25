/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationRepository } from '../repository/notification.repository';
import { DeviceTokenRepository } from '../repository/device-token.repository';
import { EmailService } from '../../../integration/email/email.service';
import { PushService } from '../../../integration/push/push.service';
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
  let deviceTokenRepositoryMock: jest.Mocked<DeviceTokenRepository>;
  let emailServiceMock: jest.Mocked<EmailService>;
  let pushServiceMock: any;
  let userModelMock: any;
  let notificationRowMock: any;

  beforeEach(async () => {
    notificationRowMock = { id: 'notif-1', update: jest.fn() };
    repositoryMock = {
      create: jest.fn().mockResolvedValue(notificationRowMock),
    } as unknown as jest.Mocked<NotificationRepository>;
    deviceTokenRepositoryMock = {
      findAllForUser: jest.fn().mockResolvedValue([{ token: 'fcm-token-1' }]),
      removeTokens: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<DeviceTokenRepository>;
    emailServiceMock = {
      send: jest.fn().mockResolvedValue('sent'),
    } as unknown as jest.Mocked<EmailService>;
    pushServiceMock = {
      isConfigured: true,
      sendToTokens: jest.fn().mockResolvedValue({ sent: 1, failed: 0, invalidTokens: [] }),
    };
    userModelMock = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDispatcherService,
        { provide: NotificationRepository, useValue: repositoryMock },
        { provide: DeviceTokenRepository, useValue: deviceTokenRepositoryMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: PushService, useValue: pushServiceMock },
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
      category: 'applications',
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
      expected: { inApp: boolean; email: boolean; push: boolean };
    }[] = [
      {
        name: 'defaults: all channels on',
        entry: entry({}),
        settings: { ...defaultSettings },
        expected: { inApp: true, email: true, push: true },
      },
      {
        name: 'category off suppresses medium/low entirely',
        entry: entry({ priority: 'medium' }),
        settings: { ...defaultSettings, applicationUpdates: false },
        expected: { inApp: false, email: false, push: false },
      },
      {
        name: 'category off still lands critical in-app (no email; push follows in-app)',
        entry: entry({ priority: 'critical' }),
        settings: { ...defaultSettings, applicationUpdates: false },
        expected: { inApp: true, email: false, push: true },
      },
      {
        name: 'email master toggle off suppresses only email',
        entry: entry({}),
        settings: { ...defaultSettings, emailNotifications: false },
        expected: { inApp: true, email: false, push: true },
      },
      {
        name: 'push master toggle off suppresses only push',
        entry: entry({}),
        settings: { ...defaultSettings, pushNotifications: false },
        expected: { inApp: true, email: true, push: false },
      },
      {
        name: 'security category bypasses category/email toggles',
        entry: entry({ category: 'security' }),
        settings: {
          ...defaultSettings,
          applicationUpdates: false,
          paymentAlerts: false,
          emailNotifications: false,
        },
        expected: { inApp: true, email: true, push: true },
      },
      {
        name: 'security still honors the push master toggle',
        entry: entry({ category: 'security' }),
        settings: { ...defaultSettings, pushNotifications: false },
        expected: { inApp: true, email: true, push: false },
      },
      {
        name: 'missing settings (pre-migration user) count as enabled',
        entry: entry({}),
        settings: null,
        expected: { inApp: true, email: true, push: true },
      },
      {
        name: 'in-app-only entry never emails',
        entry: entry({ channels: ['inApp'] }),
        settings: { ...defaultSettings },
        expected: { inApp: true, email: false, push: true },
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
          category: 'applications',
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

    it('sends a push to the recipient device tokens with routing data', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);

      await service.dispatch(input);

      expect(pushServiceMock.sendToTokens).toHaveBeenCalledWith(
        ['fcm-token-1'],
        expect.objectContaining({
          data: expect.objectContaining({ type: 'application.accepted' }),
        }),
      );
    });

    it('prunes tokens FCM reports as dead', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);
      pushServiceMock.sendToTokens.mockResolvedValue({
        sent: 0,
        failed: 1,
        invalidTokens: ['fcm-token-1'],
      });

      await service.dispatch(input);

      expect(deviceTokenRepositoryMock.removeTokens).toHaveBeenCalledWith(['fcm-token-1']);
    });

    it('skips push entirely when the user disabled pushNotifications', async () => {
      userModelMock.findAll.mockResolvedValue([
        makeUser({
          notificationSettings: { ...defaultSettings, pushNotifications: false },
        }),
      ]);

      await service.dispatch(input);

      expect(pushServiceMock.sendToTokens).not.toHaveBeenCalled();
      expect(repositoryMock.create).toHaveBeenCalled();
    });

    it('a push failure never breaks the dispatch (in-app + email still land)', async () => {
      userModelMock.findAll.mockResolvedValue([makeUser()]);
      deviceTokenRepositoryMock.findAllForUser.mockRejectedValue(new Error('db hiccup'));

      await expect(service.dispatch(input)).resolves.toBeUndefined();

      expect(emailServiceMock.send).toHaveBeenCalled();
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
