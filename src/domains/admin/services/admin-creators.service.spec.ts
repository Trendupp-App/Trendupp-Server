/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { NotFoundException } from '@nestjs/common';
import { AdminCreatorsService } from './admin-creators.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Niche } from '../../users/entities/niche.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditLogService } from './audit-log.service';

describe('AdminCreatorsService - Moderation', () => {
  let service: AdminCreatorsService;
  let userModelMock: any;
  let roleModelMock: any;
  let notificationsServiceMock: any;
  let auditLogServiceMock: any;

  const mockAdmin: any = {
    id: 'admin-uuid-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@trendupp.com',
  };

  const createMockCreator = (overrides = {}) => ({
    id: 'creator-uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    roleId: 'role-creator-id',
    isActive: true,
    canApplyToCampaigns: true,
    isBanned: false,
    bannedAt: null,
    banReason: null,
    update: jest.fn().mockImplementation(function (this: any, updates: any) {
      Object.assign(this, updates);
      return Promise.resolve(this);
    }),
    ...overrides,
  });

  beforeEach(async () => {
    userModelMock = {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
    };

    roleModelMock = {
      findOne: jest.fn().mockResolvedValue({ id: 'role-creator-id', name: 'creator' }),
    };

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(true),
    };

    auditLogServiceMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCreatorsService,
        { provide: getModelToken(User), useValue: userModelMock },
        { provide: getModelToken(Role), useValue: roleModelMock },
        { provide: getModelToken(Niche), useValue: {} },
        { provide: getModelToken(Nationality), useValue: {} },
        { provide: getModelToken(CampaignApplication), useValue: {} },
        { provide: getModelToken(PaymentRelease), useValue: {} },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
      ],
    }).compile();

    service = module.get<AdminCreatorsService>(AdminCreatorsService);
  });

  describe('updateCreatorCampaignAccess', () => {
    it('should suspend campaign access, log audit, and send user + admin notifications', async () => {
      const creator = createMockCreator();
      userModelMock.findOne.mockResolvedValue(creator);

      const result = await service.updateCreatorCampaignAccess(mockAdmin, creator.id, {
        canApply: false,
        reason: 'Too many declined deliverables',
      });

      expect(creator.update).toHaveBeenCalledWith({ canApplyToCampaigns: false });
      expect(result.success).toBe(true);
      expect(result.user.canApplyToCampaigns).toBe(false);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'CREATOR_CAMPAIGN_ACCESS_SUSPENDED',
          targetUserId: creator.id,
        }),
      );

      // User notification
      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'campaign_access.suspended',
        recipientId: creator.id,
        actorId: mockAdmin.id,
        data: { reason: 'Too many declined deliverables' },
      });

      // Staff admin feed notification
      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.creator_campaign_access_suspended',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          creatorId: creator.id,
          creatorName: 'Jane Doe',
          adminName: 'Admin User',
          reason: 'Too many declined deliverables',
        },
      });
    });

    it('should reactivate campaign access, log audit, and send user + admin notifications', async () => {
      const creator = createMockCreator({ canApplyToCampaigns: false });
      userModelMock.findOne.mockResolvedValue(creator);

      const result = await service.updateCreatorCampaignAccess(mockAdmin, creator.id, {
        canApply: true,
      });

      expect(creator.update).toHaveBeenCalledWith({ canApplyToCampaigns: true });
      expect(result.success).toBe(true);
      expect(result.user.canApplyToCampaigns).toBe(true);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'CREATOR_CAMPAIGN_ACCESS_REACTIVATED',
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'campaign_access.reactivated',
        recipientId: creator.id,
        actorId: mockAdmin.id,
        data: {},
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.creator_campaign_access_reactivated',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          creatorId: creator.id,
          creatorName: 'Jane Doe',
          adminName: 'Admin User',
        },
      });
    });

    it('should throw NotFoundException if creator is not found', async () => {
      userModelMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateCreatorCampaignAccess(mockAdmin, 'unknown-id', { canApply: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspendCreator', () => {
    it('should suspend creator account, log audit, and send user + admin notifications', async () => {
      const creator = createMockCreator();
      userModelMock.findOne.mockResolvedValue(creator);

      const result = await service.suspendCreator(mockAdmin, creator.id, {
        reason: 'Investigating fraudulent activity',
      });

      expect(creator.update).toHaveBeenCalledWith({ isActive: false });
      expect(result.success).toBe(true);
      expect(result.user.isActive).toBe(false);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'CREATOR_SUSPENDED',
          targetUserId: creator.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.suspended',
        recipientId: creator.id,
        actorId: mockAdmin.id,
        data: { reason: 'Investigating fraudulent activity' },
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_suspended',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: creator.id,
          userName: 'Jane Doe',
          userRole: 'creator',
          adminName: 'Admin User',
          reason: 'Investigating fraudulent activity',
        },
      });
    });
  });

  describe('reactivateCreator', () => {
    it('should reactivate creator account, log audit, and send user + admin notifications', async () => {
      const creator = createMockCreator({ isActive: false });
      userModelMock.findOne.mockResolvedValue(creator);

      const result = await service.reactivateCreator(mockAdmin, creator.id);

      expect(creator.update).toHaveBeenCalledWith({ isActive: true });
      expect(result.success).toBe(true);
      expect(result.user.isActive).toBe(true);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'CREATOR_REACTIVATED',
          targetUserId: creator.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.reactivated',
        recipientId: creator.id,
        actorId: mockAdmin.id,
        data: {},
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_reactivated',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: creator.id,
          userName: 'Jane Doe',
          userRole: 'creator',
          adminName: 'Admin User',
        },
      });
    });
  });

  describe('banCreator', () => {
    it('should permanently ban creator account, record ban details, and send user + admin notifications', async () => {
      const creator = createMockCreator();
      userModelMock.findOne.mockResolvedValue(creator);

      const result = await service.banCreator(mockAdmin, creator.id, {
        reason: 'Severe platform terms violation',
      });

      expect(creator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isBanned: true,
          isActive: false,
          banReason: 'Severe platform terms violation',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.user.isBanned).toBe(true);
      expect(result.user.isActive).toBe(false);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'CREATOR_BANNED',
          targetUserId: creator.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.banned',
        recipientId: creator.id,
        actorId: mockAdmin.id,
        data: { reason: 'Severe platform terms violation' },
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_banned',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: creator.id,
          userName: 'Jane Doe',
          userRole: 'creator',
          adminName: 'Admin User',
          reason: 'Severe platform terms violation',
        },
      });
    });
  });
});
