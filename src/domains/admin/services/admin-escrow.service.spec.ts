import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { AdminEscrowService } from './admin-escrow.service';
import { Payment } from '../../campaigns/entities/payment.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { User } from '../../users/entities/user.entity';
import { CampaignsService } from '../../campaigns/services/campaigns.service';

describe('AdminEscrowService', () => {
  let service: AdminEscrowService;
  let paymentModelMock: { findAll: jest.Mock; findAndCountAll: jest.Mock };
  let paymentReleaseModelMock: { findAll: jest.Mock; findAndCountAll: jest.Mock };
  let campaignRefundModelMock: { findAll: jest.Mock; findAndCountAll: jest.Mock };
  let campaignModelMock: { findAll: jest.Mock };
  let userModelMock: { findAll: jest.Mock };
  let campaignsServiceMock: { calculateBreakdown: jest.Mock };

  const mockPaymentItem = {
    id: 'pay-1',
    totalAmount: 3500000,
    amount: 3500000,
    paymentStatus: 'paid',
    escrowStatus: 'funded',
    currency: 'NGN',
    createdAt: new Date('2026-06-15'),
    updatedAt: new Date('2026-06-15'),
    campaign: {
      id: 'camp-1',
      title: 'Summer Style Collection 2025',
      brandId: 'b-1',
      status: 'active',
      brand: { id: 'b-1', companyName: 'Konga' },
    },
  };

  const mockReleaseItem = {
    id: 'pr-1',
    amount: 120000,
    status: 'released',
    releaseDate: new Date('2026-06-15'),
    updatedAt: new Date('2026-06-15'),
    campaign: {
      id: 'camp-1',
      title: 'Summer Style Collection 2025',
      brand: { companyName: 'Konga' },
    },
    creator: { id: 'c-1', firstName: 'Jane', lastName: 'Doe', avatarUrl: null },
  };

  const mockRefundItem = {
    id: 'rf-1',
    amount: 120000,
    status: 'failed',
    releaseDate: new Date('2026-06-15'),
    updatedAt: new Date('2026-06-15'),
    errorDetails: 'Transfer rejected by bank',
    campaign: { id: 'camp-1', title: 'Summer Style Collection 2025' },
    brand: { id: 'b-1', companyName: 'Konga', avatarUrl: null },
  };

  beforeEach(async () => {
    paymentModelMock = {
      findAll: jest.fn().mockResolvedValue([mockPaymentItem]),
      findAndCountAll: jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockPaymentItem],
      }),
    };

    paymentReleaseModelMock = {
      findAll: jest.fn().mockResolvedValue([mockReleaseItem]),
      findAndCountAll: jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockReleaseItem],
      }),
    };

    campaignRefundModelMock = {
      findAll: jest.fn().mockResolvedValue([mockRefundItem]),
      findAndCountAll: jest.fn().mockResolvedValue({
        count: 1,
        rows: [mockRefundItem],
      }),
    };

    campaignModelMock = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    userModelMock = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    campaignsServiceMock = {
      calculateBreakdown: jest.fn().mockResolvedValue({
        campaignBudget: 2607500,
        trenduppFee: 525000,
        vat: 262500,
        pandascrowFee: 105000,
        totalToPay: 3500000,
        breakdownItems: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEscrowService,
        { provide: getModelToken(Payment), useValue: paymentModelMock },
        { provide: getModelToken(PaymentRelease), useValue: paymentReleaseModelMock },
        { provide: getModelToken(CampaignRefund), useValue: campaignRefundModelMock },
        { provide: getModelToken(Campaign), useValue: campaignModelMock },
        { provide: getModelToken(User), useValue: userModelMock },
        { provide: CampaignsService, useValue: campaignsServiceMock },
      ],
    }).compile();

    service = module.get<AdminEscrowService>(AdminEscrowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGlobalSummary', () => {
    it('should compute global advertisers spend, agency commission, creator payout, and escrow balance', async () => {
      const result = await service.getGlobalSummary();
      expect(result.totalAdvertisersSpend).toBe(3500000);
      expect(result.totalAgencyCommission).toBe(525000);
      expect(result.totalCreatorPayout).toBe(120000);
      expect(result.totalEscrowBalance).toBe(3500000);
    });
  });

  describe('getOverview', () => {
    it('should return overview summary, monthly chart metrics, and recent activity with financial breakdown', async () => {
      const result = await service.getOverview({ year: 2026 });
      expect(result.summary.totalAdvertisersSpend).toBe(3500000);
      expect(result.charts.advertisersSpend.length).toBe(12);
      expect(result.recentActivity.length).toBe(1);
      expect(result.recentActivity[0].breakdown.agencyCommission).toBe(525000);
      expect(result.recentActivity[0].breakdown.vat).toBe(262500);
      expect(result.recentActivity[0].breakdown.gatewayCharges).toBe(105000);
      expect(result.recentActivity[0].breakdown.creatorNetBudget).toBe(2607500);
    });
  });

  describe('getEscrowBalances', () => {
    it('should return current money in escrow and paginated active escrows', async () => {
      const result = await service.getEscrowBalances({ page: 1, limit: 10 });
      expect(result.currentMoneyInEscrow).toBe(3500000);
      expect(result.data.length).toBe(1);
      expect(result.data[0].campaignTitle).toBe('Summer Style Collection 2025');
    });
  });

  describe('getCreatorPayouts', () => {
    it('should return payout metrics and paginated creator release list', async () => {
      const result = await service.getCreatorPayouts({ page: 1, limit: 10 });
      expect(result.metrics.successful.count).toBe(1);
      expect(result.metrics.successful.totalAmount).toBe(120000);
      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe('successful');
    });
  });

  describe('getAdvertiserRefunds', () => {
    it('should return refund metrics and paginated refund list', async () => {
      const result = await service.getAdvertiserRefunds({ page: 1, limit: 10 });
      expect(result.metrics.failed.count).toBe(1);
      expect(result.metrics.failed.totalAmount).toBe(120000);
      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe('failed');
      expect(result.data[0].failureReason).toBe('Transfer rejected by bank');
    });
  });
});
