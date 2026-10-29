/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { NotFoundException } from '@nestjs/common';
import { AdminBrandsService } from './admin-brands.service';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Industry } from '../../users/entities/industry.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditLogService } from './audit-log.service';

describe('AdminBrandsService - Moderation', () => {
  let service: AdminBrandsService;
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

  const createMockBrand = (overrides = {}) => ({
    id: 'brand-uuid-1',
    firstName: 'Pepsi',
    lastName: 'Nigeria',
    username: 'pepsing',
    email: 'info@pepsi.ng',
    roleId: 'role-brand-id',
    isActive: true,
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
      findOne: jest.fn().mockResolvedValue({ id: 'role-brand-id', name: 'brand' }),
    };

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(true),
    };

    auditLogServiceMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBrandsService,
        { provide: getModelToken(User), useValue: userModelMock },
        { provide: getModelToken(Role), useValue: roleModelMock },
        { provide: getModelToken(Industry), useValue: {} },
        { provide: getModelToken(Nationality), useValue: {} },
        { provide: getModelToken(Campaign), useValue: {} },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
      ],
    }).compile();

    service = module.get<AdminBrandsService>(AdminBrandsService);
  });

  describe('suspendBrand', () => {
    it('should suspend brand account, log audit, and send user + admin notifications', async () => {
      const brand = createMockBrand();
      userModelMock.findOne.mockResolvedValue(brand);

      const result = await service.suspendBrand(mockAdmin, brand.id, {
        reason: 'Payment disputes investigation',
      });

      expect(brand.update).toHaveBeenCalledWith({ isActive: false });
      expect(result.success).toBe(true);
      expect(result.user.isActive).toBe(false);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'BRAND_SUSPENDED',
          targetUserId: brand.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.suspended',
        recipientId: brand.id,
        actorId: mockAdmin.id,
        data: { reason: 'Payment disputes investigation' },
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_suspended',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: brand.id,
          userName: 'Pepsi Nigeria',
          userRole: 'brand',
          adminName: 'Admin User',
          reason: 'Payment disputes investigation',
        },
      });
    });

    it('should throw NotFoundException if brand is not found', async () => {
      userModelMock.findOne.mockResolvedValue(null);

      await expect(service.suspendBrand(mockAdmin, 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivateBrand', () => {
    it('should reactivate brand account, log audit, and send user + admin notifications', async () => {
      const brand = createMockBrand({ isActive: false });
      userModelMock.findOne.mockResolvedValue(brand);

      const result = await service.reactivateBrand(mockAdmin, brand.id);

      expect(brand.update).toHaveBeenCalledWith({ isActive: true });
      expect(result.success).toBe(true);
      expect(result.user.isActive).toBe(true);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'BRAND_REACTIVATED',
          targetUserId: brand.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.reactivated',
        recipientId: brand.id,
        actorId: mockAdmin.id,
        data: {},
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_reactivated',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: brand.id,
          userName: 'Pepsi Nigeria',
          userRole: 'brand',
          adminName: 'Admin User',
        },
      });
    });
  });

  describe('banBrand', () => {
    it('should permanently ban brand account, record ban details, and send user + admin notifications', async () => {
      const brand = createMockBrand();
      userModelMock.findOne.mockResolvedValue(brand);

      const result = await service.banBrand(mockAdmin, brand.id, {
        reason: 'Fraudulent payment activity',
      });

      expect(brand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isBanned: true,
          isActive: false,
          banReason: 'Fraudulent payment activity',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.user.isBanned).toBe(true);
      expect(result.user.isActive).toBe(false);

      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: mockAdmin.id,
          action: 'BRAND_BANNED',
          targetUserId: brand.id,
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'account.banned',
        recipientId: brand.id,
        actorId: mockAdmin.id,
        data: { reason: 'Fraudulent payment activity' },
      });

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith({
        type: 'admin.user_account_banned',
        recipientRole: ['owner', 'super_admin', 'moderator'],
        actorId: mockAdmin.id,
        data: {
          userId: brand.id,
          userName: 'Pepsi Nigeria',
          userRole: 'brand',
          adminName: 'Admin User',
          reason: 'Fraudulent payment activity',
        },
      });
    });
  });
});
