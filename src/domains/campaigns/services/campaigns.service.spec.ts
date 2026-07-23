/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { CampaignRepository } from '../repository/campaign.repository';
import { Campaign } from '../entities/campaign.entity';
import { S3Service } from '../../../integration/s3/s3.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { CreateReviewDto } from '../dtos/create-review.dto';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { CampaignReview } from '../entities/campaign-review.entity';
import { FindAllCampaignsQueryDto } from '../dtos/find-all-campaigns-query.dto';
import { UsersService } from '../../users/services/users.service';
import { PandascrowService } from '../../../integration/payment-gateway/pandascrow.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EmailService } from '../../../integration/email/email.service';
import { getModelToken } from '@nestjs/sequelize';
import { Niche } from '../../users/entities/niche.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Fee } from '../entities/fee.entity';

import { TimelineService } from './timeline.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let s3ServiceMock: jest.Mocked<S3Service>;
  let usersServiceMock: jest.Mocked<UsersService>;
  let pandascrowServiceMock: jest.Mocked<PandascrowService>;
  let notificationsServiceMock: jest.Mocked<NotificationsService>;
  let emailServiceMock: jest.Mocked<EmailService>;
  let nicheModelMock: Record<string, unknown>;
  let creatorCategoryModelMock: Record<string, unknown>;
  let feeModelMock: Record<string, unknown>;

  const mockCampaign = {
    id: 'c1',
    brandId: 'b1',
    title: 'Summer Campaign',
    goal: 'Create Content',
    totalBudget: 3000000,
    creatorCategoryId: 'cc1',
    creatorCategoryIds: ['cc1'],
    creatorNicheId: 'n1',
    creatorNicheIds: ['n1'],
    timeline: { stage1_application_window: { endedDate: '2026-07-31T23:59:59.999Z' } },
    status: 'draft',
    currentStep: 1,
    paymentStatus: 'unpaid',
    currency: 'USD',
    approvedAt: null,
    update: jest.fn().mockResolvedValue(undefined),
    $set: jest.fn().mockResolvedValue(undefined),

    setDataValue: jest.fn(),
    paymentBreakdown: {
      campaignBudget: 2325000,
      trenduppFee: 450000,
      vat: 225000,
      totalToPay: 3000000,
    },
  } as unknown as Campaign;

  beforeEach(async () => {
    campaignRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByBrandId: jest.fn(),
      findLiveCampaigns: jest.fn(),
      findPastCampaigns: jest.fn(),
      updateStatus: jest.fn(),
      createPayment: jest.fn(),
      createApplication: jest.fn(),
      findApplicationById: jest.fn(),
      findApplication: jest.fn(),
      findApplicationsByCampaignId: jest.fn(),
      findApplicationsByCreatorId: jest.fn(),
      findApplicationsByBrandId: jest.fn(),
      findAllApplications: jest.fn(),
      countApplications: jest.fn().mockResolvedValue(0),
      createSubmission: jest.fn(),
      findSubmissionById: jest.fn(),
      findLatestSubmissionByApplicationId: jest.fn(),
      findSubmissionsByCampaignId: jest.fn(),
      findSubmissionsByApplicationId: jest.fn(),
      findFees: jest.fn().mockResolvedValue([
        { name: 'VAT', type: 'percentage', value: 0.075 },
        { name: 'Trendupp Fee', type: 'percentage', value: 0.15 },
      ]),
      findReviewsByCreator: jest.fn(),
      findReviewByBrandAndCampaign: jest.fn(),
      recalculateCreatorRating: jest.fn(),
      createReview: jest.fn(),
      findByIdAndBrandId: jest.fn(),
      deleteDraftById: jest.fn(),
      createPaymentRelease: jest.fn(),
      findPaymentByCampaignId: jest.fn(),
      updatePayment: jest.fn().mockResolvedValue(undefined),
      findCreatorCategoryById: jest.fn(),
      raiseDispute: jest.fn(),
      countCampaignsByBrand: jest.fn().mockResolvedValue(0),
      countDisputedCampaignsByBrand: jest.fn().mockResolvedValue(0),
      findReleaseByCampaignAndCreator: jest.fn(),
      findSubmissionByCampaignAndCreator: jest.fn(),
      findApplicationByCampaignAndCreator: jest.fn(),
    } as unknown as jest.Mocked<CampaignRepository>;

    s3ServiceMock = {
      uploadFile: jest.fn().mockResolvedValue('https://mock-s3-url.com/image.jpg'),
    } as unknown as jest.Mocked<S3Service>;

    usersServiceMock = {
      findOne: jest.fn().mockResolvedValue({
        id: 'b1',
        email: 'brand@example.com',
        firstName: 'Brand',
        lastName: 'User',
        country: { currency: 'USD', isAfrican: false },
      }),
      findOneWithNiches: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    pandascrowServiceMock = {
      initializeEscrow: jest.fn(),
      requestPayout: jest.fn(),
    } as unknown as jest.Mocked<PandascrowService>;

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    emailServiceMock = {
      sendStrikeWarningEmail: jest.fn(),
      sendCreatorBlockEmail: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    Object.defineProperty(User, 'sequelize', {
      value: {
        transaction: jest.fn().mockResolvedValue({
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
        }),
      },
      configurable: true,
      writable: true,
    });
    jest.spyOn(User, 'update').mockResolvedValue([1]);

    nicheModelMock = {
      findAll: jest.fn().mockResolvedValue([{ id: 'n1', name: 'Fashion' }]),
    };

    creatorCategoryModelMock = {
      findAll: jest.fn().mockResolvedValue([{ id: 'cc1', name: 'Nano' }]),
    };

    // Returns the Pandascrow USD fee rate (5%) by default (mockCampaign.currency = 'USD')
    feeModelMock = {
      findOne: jest.fn().mockResolvedValue({ value: 0.05 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        TimelineService,
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: PandascrowService, useValue: pandascrowServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: getModelToken(Niche), useValue: nicheModelMock },
        { provide: getModelToken(CreatorCategory), useValue: creatorCategoryModelMock },
        { provide: getModelToken(Fee), useValue: feeModelMock },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a campaign with draft status and re-fetch it', async () => {
      const createData = {
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        creatorCategoryIds: ['cc1'],
        preferredPlatformIds: ['p1'],
        timeline: { stage1_application_window: { endedDate: '2026-07-31T23:59:59.999Z' } },
        creatorNicheId: 'n1',
      };

      campaignRepoMock.create.mockResolvedValue(mockCampaign);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);

      const result = await service.create('b1', createData);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.create).toHaveBeenCalledWith({
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        creatorCategoryId: 'cc1',
        creatorCategoryIds: ['cc1'],
        brandId: 'b1',
        coverImage: undefined,
        status: 'draft',
        currentStep: 1,
        paymentStatus: 'unpaid',
        timeline: { stage1_application_window: { endedDate: '2026-07-31T23:59:59.999Z' } },
        creatorNicheId: 'n1',
        creatorNicheIds: ['n1'],
        currency: 'USD',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findById).toHaveBeenCalledWith('c1');
      expect(result).toEqual(mockCampaign);
    });

    it('should upload cover image if file is provided', async () => {
      const createData = {
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        creatorCategoryIds: ['cc1'],
        preferredPlatformIds: ['p1'],
        timeline: { stage1_application_window: { endedDate: '2026-07-31T23:59:59.999Z' } },
        creatorNicheId: 'n1',
      };

      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      campaignRepoMock.create.mockResolvedValue(mockCampaign);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);

      await service.create('b1', createData, { coverImage: mockFile });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(s3ServiceMock.uploadFile).toHaveBeenCalledWith(mockFile);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.create).toHaveBeenCalledWith({
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        creatorCategoryId: 'cc1',
        creatorCategoryIds: ['cc1'],
        brandId: 'b1',
        coverImage: 'https://mock-s3-url.com/image.jpg',
        amplificationAsset: undefined,
        status: 'draft',
        currentStep: 1,
        paymentStatus: 'unpaid',
        timeline: { stage1_application_window: { endedDate: '2026-07-31T23:59:59.999Z' } },
        creatorNicheId: 'n1',
        creatorNicheIds: ['n1'],
        currency: 'USD',
      });
    });
  });

  describe('updateDraft', () => {
    it('should update draft fields successfully', async () => {
      const draft = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'draft',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(draft);

      const updateData = {
        deliverables: ['1x post'],
      };

      await service.updateDraft('c1', 'b1', updateData);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(draft.update).toHaveBeenCalledWith({
        deliverables: ['1x post'],
      });
    });

    it('should throw ForbiddenException if user does not own the campaign', async () => {
      const draft = { ...mockCampaign, brandId: 'b2', status: 'draft' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(draft);

      await expect(service.updateDraft('c1', 'b1', {})).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if campaign is not a draft', async () => {
      const campaign = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'pending_approval',
      } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(campaign);

      await expect(service.updateDraft('c1', 'b1', {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submit', () => {
    it('should throw ForbiddenException if required fields are missing on submit', async () => {
      const incompleteCampaign = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'draft',
        title: 'incomplete',
        deliverables: null, // missing required field
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(incompleteCampaign);

      await expect(service.submit('c1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('should submit successfully if complete', async () => {
      const completeCampaign = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'draft',
        title: 'complete campaign',
        goal: 'Amplify Content',
        totalBudget: 3000000,
        creatorCategoryId: 'cc1',
        creatorNicheId: 'n1',
        timeline: new Date('2026-07-31T23:59:59.999Z'),
        preferredPlatforms: [{ id: 'p1' }],
        deliverables: ['1x post'],
        contentDirection: ['d1'],
        contentGuidelines: { dos: ['do1'], donts: [] },
        usageRights: 'full rights',
        campaignBrief: 'our brand guidelines brief',
        amplificationAsset: 'https://hosted.link',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(completeCampaign);
      campaignRepoMock.findCreatorCategoryById.mockResolvedValue({
        id: 'cc1',
        name: 'Nano',
        minCostCreateNaira: 50000,
        minCostCreateUsd: 50,
        minCostAmplifyNaira: 20000,
        minCostAmplifyUsd: 20,
      } as any);
      usersServiceMock.findOne.mockResolvedValue({
        firstName: 'Brand',
        lastName: 'Owner',
        email: 'brand@owner.com',
        phoneNumber: '+2348000000000',
      } as any);

      pandascrowServiceMock.initializeEscrow.mockResolvedValue({
        escrow_id: 12345,
        payment_url: 'https://sandbox.pandascrow.io/checkout/12345',
        transaction_ref: 'tx_ref_123',
        provider: 'paystack',
        status: 'pending',
      });

      const mockPayment = {
        id: 'pay1',
        campaignId: 'c1',
        amount: 2325000,
        totalAmount: 3000000,
        gatewayFee: 117000,
        paymentStatus: 'pending',
        paymentReference: 'tx_ref_123',
        escrowId: '12345',
        paymentUrl: 'https://sandbox.pandascrow.io/checkout/12345',
        transactionRef: 'tx_ref_123',
        provider: 'paystack',
        escrowStatus: 'pending',
      } as any;
      campaignRepoMock.createPayment.mockResolvedValue(mockPayment);

      const result = await service.submit('c1', 'b1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(completeCampaign.update).toHaveBeenCalledWith({
        status: 'pending_payment',
        currentStep: 5,
        acceptedTerms: true,
        paymentStatus: 'pending',
      });

      expect(result).toEqual({
        campaign: completeCampaign,
        payment: mockPayment,
      });
    });

    it('should allow re-submission (retry) when status is pending_payment and payment is pending', async () => {
      const pendingPaymentCampaign = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'pending_payment',
        paymentStatus: 'pending',
        title: 'complete campaign',
        goal: 'Amplify Content',
        totalBudget: 3000000,
        creatorCategoryId: 'cc1',
        creatorNicheId: 'n1',
        timeline: new Date('2026-07-31T23:59:59.999Z'),
        preferredPlatforms: [{ id: 'p1' }],
        deliverables: ['1x post'],
        contentDirection: ['d1'],
        contentGuidelines: { dos: ['do1'], donts: [] },
        usageRights: 'full rights',
        campaignBrief: 'our brand guidelines brief',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as Campaign;

      const stalePayment = { id: 'pay-old', paymentStatus: 'pending' } as any;

      campaignRepoMock.findById.mockResolvedValue(pendingPaymentCampaign);
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue(stalePayment);
      usersServiceMock.findOne.mockResolvedValue({
        firstName: 'Brand',
        lastName: 'Owner',
        email: 'brand@owner.com',
        phoneNumber: '+2348000000000',
      } as any);

      pandascrowServiceMock.initializeEscrow.mockResolvedValue({
        escrow_id: 99999,
        payment_url: 'https://sandbox.pandascrow.io/checkout/99999',
        transaction_ref: 'tx_ref_retry',
        provider: 'paystack',
        status: 'pending',
      });

      const mockNewPayment = { id: 'pay-new', campaignId: 'c1' } as any;
      campaignRepoMock.createPayment.mockResolvedValue(mockNewPayment);

      const result = await service.submit('c1', 'b1');

      // Old payment should be cancelled
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.updatePayment).toHaveBeenCalledWith('pay-old', {
        paymentStatus: 'cancelled',
      });

      // Campaign should be updated to pending_payment again with fresh escrow
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(pendingPaymentCampaign.update).toHaveBeenCalledWith({
        status: 'pending_payment',
        currentStep: 5,
        acceptedTerms: true,
        paymentStatus: 'pending',
      });

      expect(result.payment).toEqual(mockNewPayment);
    });

    it('should throw ForbiddenException when status is pending_payment but payment is already paid', async () => {
      const paidCampaign = {
        ...mockCampaign,
        brandId: 'b1',
        status: 'pending_payment',
        paymentStatus: 'paid',
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(paidCampaign);

      await expect(service.submit('c1', 'b1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should delegate to campaignRepository.findAll without prioritization if user is not a creator', async () => {
      const mockResult = {
        data: [mockCampaign],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      campaignRepoMock.findAll.mockResolvedValue(mockResult);

      const query: FindAllCampaignsQueryDto = { status: 'live', sortBy: 'highest_budget' };
      const user = { id: 'u1', role: { name: 'brand' } } as unknown as User;
      const result = await service.findAll(query, user);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findAll).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should delegate to campaignRepository.findAll with prioritizeNicheIds if creator has niches and no explicit filters', async () => {
      const mockResult = {
        data: [mockCampaign],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      campaignRepoMock.findAll.mockResolvedValue(mockResult);

      const query: FindAllCampaignsQueryDto = { status: 'live' };
      const user = {
        id: 'u1',
        role: { name: 'creator' },
        niches: [
          { id: 'niche1', name: 'Tech' },
          { id: 'niche2', name: 'Design' },
        ],
      } as unknown as User;
      const result = await service.findAll(query, user);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findAll).toHaveBeenCalledWith(query, ['niche1', 'niche2']);
      expect(result).toEqual(mockResult);
    });

    it('should not prioritize niches if query contains explicit niche filters', async () => {
      const mockResult = {
        data: [mockCampaign],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      campaignRepoMock.findAll.mockResolvedValue(mockResult);

      const query: FindAllCampaignsQueryDto = { status: 'live', nicheIds: ['niche1'] };
      const user = {
        id: 'u1',
        role: { name: 'creator' },
        niches: [{ id: 'niche1', name: 'Tech' }],
      } as unknown as User;
      const result = await service.findAll(query, user);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findAll).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('should return a campaign with applicationsCount when found', async () => {
      const campaignWithApps = {
        ...mockCampaign,
        applications: [],
        brandId: 'brand1',
        setDataValue: jest.fn(),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(campaignWithApps);
      campaignRepoMock.countApplications = jest.fn().mockResolvedValue(5);

      const result = await service.findById('c1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.countApplications).toHaveBeenCalledWith('c1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignWithApps.setDataValue as jest.Mock).toHaveBeenCalledWith('applicationsCount', {
        total: 5,
      });
      expect(result).toEqual(campaignWithApps);
    });

    it('should throw NotFoundException when campaign is not found', async () => {
      campaignRepoMock.findById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should filter applications to only own application for creator role', async () => {
      const creatorApp = { creatorId: 'creator1', id: 'app1' };
      const otherApp = { creatorId: 'other', id: 'app2' };
      const campaignWithApps = {
        ...mockCampaign,
        brandId: 'brand1',
        applications: [creatorApp, otherApp],
        setDataValue: jest.fn(),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(campaignWithApps);
      campaignRepoMock.countApplications = jest.fn().mockResolvedValue(2);

      await service.findById('c1', { id: 'creator1', role: 'creator' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignWithApps.setDataValue as jest.Mock).toHaveBeenCalledWith('applications', [
        creatorApp,
      ]);
    });
  });

  describe('findByBrandId', () => {
    it('should delegate to campaignRepository.findByBrandId', async () => {
      campaignRepoMock.findByBrandId.mockResolvedValue([mockCampaign]);

      const result = await service.findByBrandId('b1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findByBrandId).toHaveBeenCalledWith('b1', undefined);
      expect(result).toEqual([mockCampaign]);
    });
  });

  describe('findLive', () => {
    it('should delegate to campaignRepository.findLiveCampaigns', async () => {
      const mockResult = {
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      };
      campaignRepoMock.findLiveCampaigns.mockResolvedValue(mockResult);

      const result = await service.findLive();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findLiveCampaigns).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findPast', () => {
    it('should delegate to campaignRepository.findPastCampaigns', async () => {
      const mockResult = {
        data: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      };
      campaignRepoMock.findPastCampaigns.mockResolvedValue(mockResult);

      const result = await service.findPast();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findPastCampaigns).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockResult);
    });
  });

  describe('approve', () => {
    it('should approve a pending campaign and set it to live', async () => {
      const pendingCampaign = {
        ...mockCampaign,
        status: 'pending_approval',
      } as unknown as Campaign;
      const approvedCampaign = {
        ...mockCampaign,
        status: 'approved',
        approvedAt: new Date(),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(pendingCampaign);
      campaignRepoMock.updateStatus.mockResolvedValue(approvedCampaign);

      const result = await service.approve('c1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.updateStatus).toHaveBeenCalledWith(
        'c1',
        'approved',
        expect.any(Date) as Date,
      );
      expect(result).toEqual(approvedCampaign);
    });

    it('should throw NotFoundException when campaign does not exist', async () => {
      campaignRepoMock.findById.mockResolvedValue(null);

      await expect(service.approve('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when campaign is already live', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(liveCampaign);

      await expect(service.approve('c1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when campaign is completed', async () => {
      const completedCampaign = { ...mockCampaign, status: 'completed' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(completedCampaign);

      await expect(service.approve('c1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('applyToCampaign', () => {
    const mockAppDto = {
      contentIdea: 'I will write a morning skincare styling tutorial video concept.',
      pastWorkLink: ['https://instagram.com/p/example'],
      primaryPlatformId: 'p1',
      secondaryPlatformId: 'p2',
      feeRequest: 150000,
      comments: 'Looking forward to this!',
    };

    it('should successfully submit an application for a live campaign when creator has at least one social connected', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      const mockApplication = { id: 'app1', ...mockAppDto };
      const mockCreator = {
        id: 'creator1',
        socialsConnected: { instagram: true, tiktok: false, youtube: false, twitter: false },
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockCreator as any);
      campaignRepoMock.findApplication.mockResolvedValue(null);
      campaignRepoMock.createApplication.mockResolvedValue(mockApplication as any);
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);

      const result = await service.applyToCampaign('c1', 'creator1', mockAppDto);

      expect(result).toEqual(mockApplication);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createApplication).toHaveBeenCalledWith({
        campaignId: 'c1',
        creatorId: 'creator1',
        ...mockAppDto,
      });
    });

    it('should throw ForbiddenException if campaign is not live', async () => {
      const draftCampaign = { ...mockCampaign, status: 'draft' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(draftCampaign);

      await expect(service.applyToCampaign('c1', 'creator1', mockAppDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if creator profile is not found', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      usersServiceMock.findOneWithNiches.mockResolvedValue(null);

      await expect(service.applyToCampaign('c1', 'creator1', mockAppDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if creator has no socials connected', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      const mockCreator = {
        id: 'creator1',
        socialsConnected: { instagram: false, tiktok: false, youtube: false, twitter: false },
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockCreator as any);

      await expect(service.applyToCampaign('c1', 'creator1', mockAppDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if creator has already applied', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      const mockCreator = {
        id: 'creator1',
        socialsConnected: { instagram: true, tiktok: false, youtube: false, twitter: false },
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      usersServiceMock.findOneWithNiches.mockResolvedValue(mockCreator as any);
      campaignRepoMock.findApplication.mockResolvedValue({ id: 'app1' } as any);

      await expect(service.applyToCampaign('c1', 'creator1', mockAppDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getCampaignApplications', () => {
    it('should return list of applications if requested by brand owner', async () => {
      const liveCampaign = { ...mockCampaign, brandId: 'brand1' } as unknown as Campaign;
      const mockAppsList = [{ id: 'app1' }, { id: 'app2' }];

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      campaignRepoMock.findApplicationsByCampaignId.mockResolvedValue(mockAppsList as any);

      const result = await service.getCampaignApplications('c1', 'brand1');

      expect(result).toEqual(mockAppsList);
    });

    it('should throw ForbiddenException if brand does not own the campaign', async () => {
      const liveCampaign = { ...mockCampaign, brandId: 'brand2' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(liveCampaign);

      await expect(service.getCampaignApplications('c1', 'brand1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reviewCampaignApplication', () => {
    it('should successfully update status to accepted', async () => {
      const liveCampaign = { ...mockCampaign, brandId: 'brand1' } as unknown as Campaign;
      const mockApp = {
        id: 'app1',
        campaignId: 'c1',
        update: jest.fn().mockResolvedValue(undefined),
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);

      await service.reviewCampaignApplication('c1', 'app1', 'brand1', 'accepted');

      expect(mockApp.update).toHaveBeenCalledWith({
        status: 'accepted',
        timeline: expect.any(Object),
      });
    });
  });

  describe('reviewCampaignApplicationsBatch', () => {
    it('should successfully update status to accepted in batch and auto-reject others', async () => {
      const liveCampaign = { ...mockCampaign, brandId: 'brand1' } as unknown as Campaign;
      const mockApp1 = {
        id: 'app1',
        campaignId: 'c1',
        status: 'pending',
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockApp2 = {
        id: 'app2',
        campaignId: 'c1',
        status: 'pending',
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockApp3 = {
        id: 'app3',
        campaignId: 'c1',
        status: 'pending',
        update: jest.fn().mockResolvedValue(undefined),
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      campaignRepoMock.findApplicationById.mockImplementation((id: string) => {
        if (id === 'app1') return Promise.resolve(mockApp1 as any);
        if (id === 'app2') return Promise.resolve(mockApp2 as any);
        if (id === 'app3') return Promise.resolve(mockApp3 as any);
        return Promise.resolve(null);
      });
      campaignRepoMock.findApplicationsByCampaignId.mockResolvedValue([
        mockApp1,
        mockApp2,
        mockApp3,
      ] as any);

      const results = await service.reviewCampaignApplicationsBatch(
        'c1',
        ['app1', 'app2'],
        'brand1',
        'accepted',
      );

      expect(mockApp1.update).toHaveBeenCalledWith({
        status: 'accepted',
        timeline: expect.any(Object),
      });
      expect(mockApp2.update).toHaveBeenCalledWith({
        status: 'accepted',
        timeline: expect.any(Object),
      });
      expect(mockApp3.update).toHaveBeenCalledWith({ status: 'rejected' });
      expect(results.length).toBe(2);
    });

    it('should successfully reject selected in batch without affecting others', async () => {
      const liveCampaign = { ...mockCampaign, brandId: 'brand1' } as unknown as Campaign;
      const mockApp1 = {
        id: 'app1',
        campaignId: 'c1',
        status: 'pending',
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockApp2 = {
        id: 'app2',
        campaignId: 'c1',
        status: 'pending',
        update: jest.fn().mockResolvedValue(undefined),
      };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
      campaignRepoMock.findApplicationById.mockImplementation((id: string) => {
        if (id === 'app1') return Promise.resolve(mockApp1 as any);
        if (id === 'app2') return Promise.resolve(mockApp2 as any);
        return Promise.resolve(null);
      });

      const results = await service.reviewCampaignApplicationsBatch(
        'c1',
        ['app1'],
        'brand1',
        'rejected',
      );

      expect(mockApp1.update).toHaveBeenCalledWith({ status: 'rejected' });
      expect(mockApp2.update).not.toHaveBeenCalled();
      expect(results.length).toBe(1);
    });
  });

  describe('getMyApplications', () => {
    it('should retrieve applications submitted by the creator', async () => {
      const mockAppsList = [{ id: 'app1' }];
      campaignRepoMock.findApplicationsByCreatorId.mockResolvedValue(mockAppsList as any);

      const result = await service.getMyApplications('creator1');

      expect(result).toEqual(mockAppsList);
    });
  });

  describe('getApplicationById', () => {
    const mockApp = {
      id: 'app1',
      creatorId: 'creator1',
      campaign: { brandId: 'brand1', setDataValue: jest.fn() },
      submissions: [],
    };

    it('should successfully return the application for creator owner', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);
      const result = await service.getApplicationById('app1', 'creator1', 'creator');
      expect(result).toEqual(mockApp);
    });

    it('should throw ForbiddenException if creator does not own the application', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);
      await expect(service.getApplicationById('app1', 'creator2', 'creator')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully return the application for campaign brand owner', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);
      const result = await service.getApplicationById('app1', 'brand1', 'brand');
      expect(result).toEqual(mockApp);
    });

    it('should throw ForbiddenException if brand does not own the campaign', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);
      await expect(service.getApplicationById('app1', 'brand2', 'brand')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully return the application for admin role', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApp as any);
      const result = await service.getApplicationById('app1', 'admin1', 'admin');
      expect(result).toEqual(mockApp);
    });

    it('should throw NotFoundException if application not found', async () => {
      campaignRepoMock.findApplicationById.mockResolvedValue(null);
      await expect(
        service.getApplicationById('missing-app-id', 'creator1', 'creator'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Content Submissions Flow Tests ────────────────────────────────────────

  describe('submitDraft', () => {
    it('should submit draft successfully for accepted application', async () => {
      const mockApplication = { id: 'app1', creatorId: 'creator1', status: 'accepted' };
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);
      campaignRepoMock.findLatestSubmissionByApplicationId.mockResolvedValue(null);
      campaignRepoMock.createSubmission.mockResolvedValue({ id: 'sub1' } as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue({
        id: 'sub1',
        draftLink: 'link1',
      } as any);

      const result = await service.submitDraft('c1', 'app1', 'creator1', 'link1');

      expect(result).toBeDefined();
      expect(result.draftLink).toBe('link1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createSubmission).toHaveBeenCalledWith({
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        draftLink: 'link1',
        status: 'pending_approval',
      });
    });

    it('should update existing draft and set status to revision-sent', async () => {
      const mockApplication = { id: 'app1', creatorId: 'creator1', status: 'accepted' };
      const mockSubmission = {
        id: 'sub1',
        status: 'request_revision',
        update: jest.fn().mockResolvedValue(undefined),
      };
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);
      campaignRepoMock.findLatestSubmissionByApplicationId.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue({
        id: 'sub1',
        draftLink: 'link-updated',
        status: 'revision-sent',
      } as any);

      const result = await service.submitDraft('c1', 'app1', 'creator1', 'link-updated');

      expect(result.status).toBe('revision-sent');

      expect(mockSubmission.update).toHaveBeenCalledWith({
        draftLink: 'link-updated',
        status: 'revision-sent',
        brandFeedback: null,
      });
    });

    it('should throw ForbiddenException if creator tries to submit draft but previous is already revision-sent', async () => {
      const mockApplication = { id: 'app1', creatorId: 'creator1', status: 'accepted' };
      const mockSubmission = { id: 'sub1', status: 'revision-sent' };
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);
      campaignRepoMock.findLatestSubmissionByApplicationId.mockResolvedValue(mockSubmission as any);

      await expect(service.submitDraft('c1', 'app1', 'creator1', 'another-link')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('vetDraft', () => {
    it('should update submission status to approved', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        status: 'pending_approval',
        update: jest.fn(),
      };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);

      await service.vetDraft('c1', 'sub1', 'brand1', 'approved');

      expect(mockSubmission.update).toHaveBeenCalledWith({
        status: 'approved',
        brandFeedback: null,
      });
    });

    it('should throw BadRequestException if brand tries to reject a draft on first submission', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        status: 'pending_approval',
        update: jest.fn(),
      };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);

      await expect(
        service.vetDraft('c1', 'sub1', 'brand1', 'rejected', "don't like it"),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if brand tries to request revision on revision-sent submission', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = { id: 'sub1', campaignId: 'c1', status: 'revision-sent' };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);

      await expect(
        service.vetDraft('c1', 'sub1', 'brand1', 'request_revision', 'More revisions'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow brand to reject a revised submission and raise a dispute', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        creatorId: 'creator-1',
        status: 'revision-sent',
        update: jest.fn(),
      };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.raiseDispute.mockResolvedValue({ id: 'disp1' } as any);

      await service.vetDraft('c1', 'sub1', 'brand1', 'rejected', 'Still bad quality content');

      expect(mockSubmission.update).toHaveBeenCalledWith({
        status: 'disputeraised',
        brandFeedback: 'Still bad quality content',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.raiseDispute).toHaveBeenCalledWith({
        campaignId: 'c1',
        creatorId: 'creator-1',
        brandId: 'brand1',
        reason: 'Still bad quality content',
      });
    });

    it('should register a strike for the creator on rejection, send warning email, and update brand flagging metrics', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        creatorId: 'creator-1',
        status: 'revision-sent',
        update: jest.fn(),
      };
      const mockCreator = {
        id: 'creator-1',
        email: 'creator@example.com',
        firstName: 'Creator',
        creatorStrikes: [],
        save: jest.fn(),
      };
      const mockBrand = {
        id: 'brand1',
        email: 'brand@example.com',
        firstName: 'Brand',
        isFlagged: false,
        flaggedReason: null,
        save: jest.fn(),
      };

      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.raiseDispute.mockResolvedValue({ id: 'disp1' } as any);
      usersServiceMock.findOne.mockImplementation((id: string) => {
        if (id === 'creator-1') return Promise.resolve(mockCreator as unknown as User);
        if (id === 'brand1') return Promise.resolve(mockBrand as unknown as User);
        return Promise.resolve(null);
      });

      // Mock brand stats: 3 campaigns, 2 disputes (dispute rate = 66.7% > 50%)
      campaignRepoMock.countCampaignsByBrand.mockResolvedValue(3);
      campaignRepoMock.countDisputedCampaignsByBrand.mockResolvedValue(2);

      await service.vetDraft('c1', 'sub1', 'brand1', 'rejected', 'Still bad quality content');

      expect(mockCreator.creatorStrikes).toContain('brand1');
      expect(mockCreator.save).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(emailServiceMock.sendStrikeWarningEmail).toHaveBeenCalledWith(
        'creator@example.com',
        'Creator',
        1,
      );

      expect(mockBrand.isFlagged).toBe(true);
      expect(mockBrand.flaggedReason).toContain('High dispute rate of 66.7%');
      expect(mockBrand.save).toHaveBeenCalled();
    });

    it('should block the creator when strikes reach 3 and send block notification email', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand3' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        creatorId: 'creator-1',
        status: 'revision-sent',
        update: jest.fn(),
      };
      const mockCreator = {
        id: 'creator-1',
        email: 'creator@example.com',
        firstName: 'Creator',
        creatorStrikes: ['brand1', 'brand2'],
        isActive: true,
        flaggedReason: null,
        save: jest.fn(),
      };
      const mockBrand = {
        id: 'brand3',
        email: 'brand@example.com',
        firstName: 'Brand',
        isFlagged: false,
        flaggedReason: null,
        save: jest.fn(),
      };

      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.raiseDispute.mockResolvedValue({ id: 'disp1' } as any);
      usersServiceMock.findOne.mockImplementation((id: string) => {
        if (id === 'creator-1') return Promise.resolve(mockCreator as unknown as User);
        if (id === 'brand3') return Promise.resolve(mockBrand as unknown as User);
        return Promise.resolve(null);
      });

      await service.vetDraft('c1', 'sub1', 'brand3', 'rejected', 'Still bad quality content');

      expect(mockCreator.creatorStrikes).toContain('brand3');
      expect(mockCreator.isActive).toBe(false);
      expect(mockCreator.flaggedReason).toContain('Blocked: Received 3 strikes');
      expect(mockCreator.save).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(emailServiceMock.sendCreatorBlockEmail).toHaveBeenCalledWith(
        'creator@example.com',
        'Creator',
      );
    });
  });

  describe('submitLivePost', () => {
    it('should run validator and update submission status to done', async () => {
      const mockCampaignVal = { id: 'c1', update: jest.fn() };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        status: 'approved',
        update: jest.fn(),
      };
      const mockApplication = { id: 'app1', update: jest.fn() };

      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);

      await service.submitLivePost('c1', 'sub1', 'creator1', {
        instagram: 'https://instagram.com/p/live',
      });

      expect(mockSubmission.update).toHaveBeenCalledWith({
        liveLink: {
          instagram: 'https://instagram.com/p/live',
        },
        status: 'livelink_available',
      });
    });
  });

  describe('approveLivePost', () => {
    it('should successfully approve live post, set status to done, and create payment release', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'b1', status: 'active', totalBudget: 150000 };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        status: 'livelink_available',
        update: jest.fn(),
      };
      const mockApplication = { id: 'app1', feeRequest: 150000 };

      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication as any);
      campaignRepoMock.createPaymentRelease.mockResolvedValue({ id: 'rel1' } as any);
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue(null);

      const result = await service.approveLivePost('c1', 'sub1', 'b1');

      expect(mockSubmission.update).toHaveBeenCalledWith({ status: 'done' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createPaymentRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: 'c1',
          creatorId: 'creator1',
          applicationId: 'app1',
          amount: 150000,
          status: 'pending',
          escrowId: null,
          releaseDate: expect.any(Date) as Date,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if brand does not own the campaign', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'different_brand', status: 'active' };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);

      await expect(service.approveLivePost('c1', 'sub1', 'b1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if submission status is not livelink_available', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'b1', status: 'active' };
      const mockSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        status: 'pending_approval',
      };

      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);

      await expect(service.approveLivePost('c1', 'sub1', 'b1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Reviews & Ratings', () => {
    const mockBrandUser = {
      id: 'brand1',
      role: { name: 'brand' },
    } as unknown as User;

    const mockReviewDto: CreateReviewDto = {
      campaignId: 'c1',
      creatorId: 'creator1',
      starRating: 5,
      comment: 'Excellent content creator!',
    };

    const mockCampaignCompleted = {
      id: 'c1',
      brandId: 'brand1',
      status: 'completed',
    } as unknown as Campaign;

    const mockApplicationApproved = {
      id: 'app1',
      status: 'approved',
      creatorId: 'creator1',
    } as unknown as CampaignApplication;

    it('should submit a review successfully and recalculate rating', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaignCompleted);
      campaignRepoMock.findApplication.mockResolvedValue(mockApplicationApproved);
      campaignRepoMock.findReviewByBrandAndCampaign.mockResolvedValue(null);
      campaignRepoMock.createReview.mockResolvedValue({ id: 'rev1' } as unknown as CampaignReview);
      campaignRepoMock.recalculateCreatorRating.mockResolvedValue({
        avgRating: 4.5,
        totalReviews: 2,
      });

      const result = await service.submitReview(mockReviewDto, mockBrandUser);

      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createReview).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.recalculateCreatorRating).toHaveBeenCalledWith(
        'creator1',
        expect.any(Object),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(User.update).toHaveBeenCalledWith(
        { avgRating: 4.5, totalReviews: 2 },
        { where: { id: 'creator1' }, transaction: expect.any(Object) as unknown },
      );
    });

    it('should throw NotFoundException if campaign does not exist', async () => {
      campaignRepoMock.findById.mockResolvedValue(null);

      await expect(service.submitReview(mockReviewDto, mockBrandUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if brand does not own the campaign', async () => {
      const otherBrand = {
        ...mockCampaignCompleted,
        brandId: 'other_brand',
      } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(otherBrand);

      await expect(service.submitReview(mockReviewDto, mockBrandUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if campaign is not completed', async () => {
      const draftCampaign = { ...mockCampaignCompleted, status: 'live' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(draftCampaign);

      await expect(service.submitReview(mockReviewDto, mockBrandUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if creator was not approved', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaignCompleted);
      campaignRepoMock.findApplication.mockResolvedValue(null);

      await expect(service.submitReview(mockReviewDto, mockBrandUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if review is duplicate', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaignCompleted);
      campaignRepoMock.findApplication.mockResolvedValue(mockApplicationApproved);
      campaignRepoMock.findReviewByBrandAndCampaign.mockResolvedValue({
        id: 'existing_review',
      } as unknown as CampaignReview);

      await expect(service.submitReview(mockReviewDto, mockBrandUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should get creator reviews', async () => {
      const mockReviews = [{ id: 'rev1', starRating: 5 }];
      campaignRepoMock.findReviewsByCreator.mockResolvedValue(
        mockReviews as unknown as CampaignReview[],
      );

      const result = await service.getCreatorReviews('creator1', {
        id: 'brand1',
        role: 'brand',
      });
      expect(result).toEqual(mockReviews);
    });

    it('should throw ForbiddenException if another creator tries to view reviews', async () => {
      await expect(
        service.getCreatorReviews('creator1', {
          id: 'creator2',
          role: 'creator',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteDraft', () => {
    it('should permanently delete a campaign when it is in draft status and owned by the brand', async () => {
      const draftCampaign = { id: 'c1', brandId: 'b1', status: 'draft' } as unknown as Campaign;
      campaignRepoMock.findByIdAndBrandId.mockResolvedValue(draftCampaign);
      campaignRepoMock.deleteDraftById.mockResolvedValue();

      await expect(service.deleteDraft('c1', 'b1')).resolves.toBeUndefined();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findByIdAndBrandId).toHaveBeenCalledWith('c1', 'b1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.deleteDraftById).toHaveBeenCalledWith('c1', 'b1');
    });

    it('should throw NotFoundException when campaign is not found or not owned by brand', async () => {
      campaignRepoMock.findByIdAndBrandId.mockResolvedValue(null);

      await expect(service.deleteDraft('nonexistent', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when campaign status is not draft', async () => {
      const liveCampaign = { id: 'c2', brandId: 'b1', status: 'live' } as unknown as Campaign;
      campaignRepoMock.findByIdAndBrandId.mockResolvedValue(liveCampaign);

      await expect(service.deleteDraft('c2', 'b1')).rejects.toThrow(ForbiddenException);

      // deleteDraftById must NOT have been called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.deleteDraftById).not.toHaveBeenCalled();
    });
  });

  describe('validateCreatorSelection', () => {
    it('should return isValid true when selected creator total proposed fee fits in the budget pool', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);
      // Mock payment amount (available pool) to 1,000,000 NGN
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue({
        paymentStatus: 'paid',
        amount: 1000000,
      } as any);

      // Selected creator fee is 450,000 NGN
      campaignRepoMock.findApplicationById.mockResolvedValue({
        id: 'app1',
        campaignId: 'c1',
        feeRequest: 450000,
      } as any);

      const result = await service.validateCreatorSelection('c1', ['app1']);
      expect(result.isValid).toBe(true);
      expect(result.shortfall).toBe(0);
      expect(result.amountAvailable).toBe(1000000);
      expect(result.selectedTotal).toBe(450000);
    });

    it('should return isValid false and correct shortfall when selected creator total proposed fee exceeds budget pool', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue({
        paymentStatus: 'paid',
        amount: 500000,
      } as any);

      campaignRepoMock.findApplicationById.mockResolvedValue({
        id: 'app1',
        campaignId: 'c1',
        feeRequest: 650000,
      } as any);

      const result = await service.validateCreatorSelection('c1', ['app1']);
      expect(result.isValid).toBe(false);
      expect(result.shortfall).toBe(150000);
      expect(result.amountAvailable).toBe(500000);
      expect(result.selectedTotal).toBe(650000);
    });
  });

  describe('reviewCampaignApplicationsBatch Guardrail', () => {
    it('should throw BadRequestException if accepted creator total fee request exceeds budget pool', async () => {
      const campaign = { id: 'c1', brandId: 'b1', status: 'live' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(campaign);

      // Budget pool is 100,000 NGN
      campaignRepoMock.findPaymentByCampaignId.mockResolvedValue({
        paymentStatus: 'paid',
        amount: 100000,
      } as any);

      // Selected creator fee is 150,000 NGN
      campaignRepoMock.findApplicationById.mockResolvedValue({
        id: 'app1',
        campaignId: 'c1',
        feeRequest: 150000,
      } as any);

      await expect(
        service.reviewCampaignApplicationsBatch('c1', ['app1'], 'b1', 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('populateBreakdown brand owner visibility', () => {
    it('should NOT mask amplificationAsset if the requestingUserId is the brandId of the campaign', async () => {
      const campaign = {
        id: 'c1',
        brandId: 'brand-owner-1',
        totalBudget: 100000,
        amplificationAsset: 'https://protected.link/file.mp4',
        setDataValue: jest.fn(),
      } as any;

      await service.populateBreakdown(campaign, 'brand-owner-1');

      // setDataValue('amplificationAsset', null) should NOT have been called
      expect(campaign.setDataValue).not.toHaveBeenCalledWith('amplificationAsset', null);
    });

    it('should mask amplificationAsset if the requestingUserId is undefined or different from brandId', async () => {
      const campaign = {
        id: 'c1',
        brandId: 'brand-owner-1',
        totalBudget: 100000,
        amplificationAsset: 'https://protected.link/file.mp4',
        setDataValue: jest.fn(),
      } as any;

      await service.populateBreakdown(campaign, 'creator-user-2');

      // setDataValue('amplificationAsset', null) SHOULD have been called
      expect(campaign.setDataValue).toHaveBeenCalledWith('amplificationAsset', null);
    });
  });

  describe('submitLivePost for Amplify Content goal', () => {
    it('should dynamically create a pre-approved submission and save the live link when none exists yet', async () => {
      const mockApplication = {
        id: 'app1',
        campaignId: 'c1',
        creatorId: 'creator1',
        status: 'accepted',
      } as any;

      const mockCampaignWithGoal = {
        id: 'c1',
        goal: 'Amplify Content',
        amplificationAsset: 'https://protected.link/file.mp4',
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      const mockNewSubmission = {
        id: 'sub1',
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        status: 'approved',
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      campaignRepoMock.findSubmissionById.mockResolvedValueOnce(null);
      campaignRepoMock.findApplicationById.mockResolvedValue(mockApplication);
      campaignRepoMock.findById.mockResolvedValue(mockCampaignWithGoal);
      campaignRepoMock.createSubmission.mockResolvedValue(mockNewSubmission);
      campaignRepoMock.findSubmissionById.mockResolvedValueOnce(mockNewSubmission);

      const result = await service.submitLivePost('c1', 'app1', 'creator1', {
        instagram: 'https://instagram.com/p/123',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createSubmission).toHaveBeenCalledWith({
        campaignId: 'c1',
        applicationId: 'app1',
        creatorId: 'creator1',
        draftLink: 'https://protected.link/file.mp4',
        status: 'approved',
      });

      expect(mockNewSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'livelink_available',
        }),
      );
      expect(result).toBeDefined();
    });
  });
});
