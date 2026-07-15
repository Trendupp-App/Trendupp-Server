/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PayoutScheduler } from './payout.scheduler';
import { CampaignRepository } from '../repository/campaign.repository';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/services/notifications.service';

describe('PayoutScheduler', () => {
  let scheduler: PayoutScheduler;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let usersServiceMock: jest.Mocked<UsersService>;
  let pandascrowServiceMock: jest.Mocked<PandascrowService>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let notificationsServiceMock: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    campaignRepoMock = {
      findDuePendingReleases: jest.fn(),
      findPaymentByCampaignId: jest.fn(),
      countPendingReleases: jest.fn(),
      countActiveSubmissions: jest.fn(),
      findById: jest.fn(),
      sumPaymentReleases: jest.fn(),
      createRefund: jest.fn(),
      findRefundByCampaignId: jest.fn(),
      findPendingRefunds: jest.fn(),
      findEndedCampaignsWithoutRefund: jest.fn(),
    } as any;

    usersServiceMock = {
      findOne: jest.fn(),
    } as any;

    pandascrowServiceMock = {
      requestPayout: jest.fn(),
    } as any;

    configServiceMock = {
      get: jest.fn().mockReturnValue(1),
    } as any;

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutScheduler,
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: PandascrowService, useValue: pandascrowServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    scheduler = module.get<PayoutScheduler>(PayoutScheduler);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('scanAndQueueRefunds', () => {
    it('should queue refunds for ended campaigns with remaining budget', async () => {
      const mockCampaign = {
        id: 'c1',
        brandId: 'b1',
        totalBudget: 1000000,
        currency: 'NGN',
      };

      campaignRepoMock.findEndedCampaignsWithoutRefund.mockResolvedValue([mockCampaign as any]);
      campaignRepoMock.sumPaymentReleases.mockResolvedValue(900000); // 100k remaining

      await scheduler.scanAndQueueRefunds();

      expect(campaignRepoMock.createRefund).toHaveBeenCalledWith({
        campaignId: 'c1',
        brandId: 'b1',
        amount: 100000,
        status: 'pending',
        currency: 'NGN',
      });
    });

    it('should queue a zero-amount completed refund if no remaining budget', async () => {
      const mockCampaign = {
        id: 'c1',
        brandId: 'b1',
        totalBudget: 1000000,
        currency: 'NGN',
      };

      campaignRepoMock.findEndedCampaignsWithoutRefund.mockResolvedValue([mockCampaign as any]);
      campaignRepoMock.sumPaymentReleases.mockResolvedValue(1000000); // 0 remaining

      await scheduler.scanAndQueueRefunds();

      expect(campaignRepoMock.createRefund).toHaveBeenCalledWith({
        campaignId: 'c1',
        brandId: 'b1',
        amount: 0,
        status: 'completed',
        currency: 'NGN',
      });
    });
  });

  describe('processPendingRefunds', () => {
    it('should request payout and complete refund if details and escrow are valid', async () => {
      const mockBrand = {
        id: 'b1',
        email: 'brand@test.com',
        firstName: 'Brand',
        lastName: 'User',
        bankAccountNumber: '1234567890',
        bank: { code: '058' },
      };

      const mockRefund = {
        id: 'r1',
        campaignId: 'c1',
        brandId: 'b1',
        amount: 100000,
        currency: 'NGN',
        update: jest.fn().mockResolvedValue(undefined),
      };

      const mockPayment = {
        campaignId: 'c1',
        escrowStatus: 'completed',
      };

      campaignRepoMock.findPendingRefunds.mockResolvedValue([mockRefund as any]);
      usersServiceMock.findOne.mockResolvedValue(mockBrand as any);
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue(mockPayment as any);
      pandascrowServiceMock.requestPayout.mockResolvedValue(true);

      await scheduler.processPendingRefunds();

      expect(pandascrowServiceMock.requestPayout).toHaveBeenCalledWith({
        payoutRef: expect.stringContaining('ref_'),
        walletId: 1,
        amount: 100000,
        currency: 'NGN',
        bankCode: '058',
        accountNumber: '1234567890',
        accountName: 'Brand User',
      });
      expect(mockRefund.update).toHaveBeenCalledWith({
        status: 'completed',
        refundReference: expect.any(String),
        errorDetails: null,
      });
    });

    it('should park refund as pending_bank_details if details are missing', async () => {
      const mockBrand = {
        id: 'b1',
        email: 'brand@test.com',
        bankAccountNumber: null,
      };

      const mockRefund = {
        id: 'r1',
        campaignId: 'c1',
        brandId: 'b1',
        amount: 100000,
        currency: 'NGN',
        update: jest.fn().mockResolvedValue(undefined),
      };

      campaignRepoMock.findPendingRefunds.mockResolvedValue([mockRefund as any]);
      usersServiceMock.findOne.mockResolvedValue(mockBrand as any);

      await scheduler.processPendingRefunds();

      expect(mockRefund.update).toHaveBeenCalledWith({
        status: 'pending_bank_details',
      });
    });
  });
});
