/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminCampaignsService } from './admin-campaigns.service';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CreatorCategory } from '../../campaigns/entities/creator-category.entity';
import { Platform } from '../../campaigns/entities/platform.entity';
import { CampaignApplication } from '../../campaigns/entities/campaign-application.entity';
import { ContentSubmission } from '../../campaigns/entities/content-submission.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { Payment } from '../../campaigns/entities/payment.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditLogService } from './audit-log.service';

describe('AdminCampaignsService - Pause and Resume', () => {
  let service: AdminCampaignsService;
  let campaignModelMock: any;
  let applicationModelMock: any;
  let notificationsServiceMock: any;
  let auditLogServiceMock: any;

  beforeEach(async () => {
    campaignModelMock = {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
    };

    applicationModelMock = {
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(true),
    };

    auditLogServiceMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCampaignsService,
        { provide: getModelToken(Campaign), useValue: campaignModelMock },
        { provide: getModelToken(User), useValue: {} },
        { provide: getModelToken(CreatorCategory), useValue: {} },
        { provide: getModelToken(Platform), useValue: {} },
        { provide: getModelToken(CampaignApplication), useValue: applicationModelMock },
        { provide: getModelToken(ContentSubmission), useValue: {} },
        { provide: getModelToken(PaymentRelease), useValue: {} },
        { provide: getModelToken(CampaignRefund), useValue: {} },
        { provide: getModelToken(Payment), useValue: {} },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
      ],
    }).compile();

    service = module.get<AdminCampaignsService>(AdminCampaignsService);
  });

  describe('pauseCampaign', () => {
    it('should throw NotFoundException if campaign does not exist', async () => {
      campaignModelMock.findByPk.mockResolvedValue(null);

      await expect(service.pauseCampaign('admin-1', 'c-99', {})).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if campaign is already paused', async () => {
      campaignModelMock.findByPk.mockResolvedValue({ id: 'c-1', status: 'paused' });

      await expect(service.pauseCampaign('admin-1', 'c-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if campaign is draft, completed, or cancelled', async () => {
      campaignModelMock.findByPk.mockResolvedValue({ id: 'c-1', status: 'completed' });

      await expect(service.pauseCampaign('admin-1', 'c-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pause an active campaign, log audit trail, and return success', async () => {
      const mockCampaign = {
        id: 'c-1',
        brandId: 'brand-1',
        title: 'Summer Style',
        status: 'active',
        save: jest.fn().mockResolvedValue(true),
      };
      campaignModelMock.findByPk.mockResolvedValue(mockCampaign);
      applicationModelMock.findAll.mockResolvedValue([
        { id: 'app-1', creatorId: 'creator-1', status: 'accepted' },
      ]);

      const result = await service.pauseCampaign('admin-1', 'c-1', {
        reason: 'Under administrative review',
      });

      expect(mockCampaign.status).toBe('paused');
      expect(mockCampaign.save).toHaveBeenCalled();
      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-1',
          action: 'CAMPAIGN_PAUSED',
        }),
      );
      expect(notificationsServiceMock.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'campaign.paused',
          recipientId: 'brand-1',
        }),
      );
      expect(notificationsServiceMock.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'campaign.paused',
          recipientId: 'creator-1',
        }),
      );
      expect(result.message).toBe('Campaign paused successfully.');
    });
  });

  describe('resumeCampaign', () => {
    it('should throw NotFoundException if campaign does not exist', async () => {
      campaignModelMock.findByPk.mockResolvedValue(null);

      await expect(service.resumeCampaign('admin-1', 'c-99', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if campaign is not paused', async () => {
      campaignModelMock.findByPk.mockResolvedValue({ id: 'c-1', status: 'active' });

      await expect(service.resumeCampaign('admin-1', 'c-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should resume a paused campaign back to live/active status and log audit trail', async () => {
      const mockCampaign = {
        id: 'c-1',
        brandId: 'brand-1',
        title: 'Summer Style',
        status: 'paused',
        save: jest.fn().mockResolvedValue(true),
      };
      campaignModelMock.findByPk.mockResolvedValue(mockCampaign);
      applicationModelMock.count.mockResolvedValue(1);
      applicationModelMock.findAll.mockResolvedValue([
        { id: 'app-1', creatorId: 'creator-1', status: 'accepted' },
      ]);

      const result = await service.resumeCampaign('admin-1', 'c-1', {
        reason: 'Review complete',
      });

      expect(mockCampaign.status).toBe('active');
      expect(mockCampaign.save).toHaveBeenCalled();
      expect(auditLogServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'admin-1',
          action: 'CAMPAIGN_RESUMED',
        }),
      );
      expect(notificationsServiceMock.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'campaign.resumed',
          recipientId: 'brand-1',
        }),
      );
      expect(result.message).toBe('Campaign resumed successfully.');
    });
  });
});
