import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { CampaignRepository } from '../repository/campaign.repository';
import { Campaign } from '../entities/campaign.entity';
import { S3Service } from '../../../integration/s3/s3.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UrlValidatorService } from '../../../integration/url-validator/url-validator.service';
import { User } from '../../users/entities/user.entity';
import { CreateReviewDto } from '../dtos/create-review.dto';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { CampaignReview } from '../entities/campaign-review.entity';
import { FindAllCampaignsQueryDto } from '../dtos/find-all-campaigns-query.dto';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let s3ServiceMock: jest.Mocked<S3Service>;
  let urlValidatorMock: jest.Mocked<UrlValidatorService>;

  const mockCampaign = {
    id: 'c1',
    brandId: 'b1',
    title: 'Summer Campaign',
    goal: 'Create Content',
    totalBudget: 3000000,
    creatorCategoryId: 'cc1',
    creatorNicheId: 'n1',
    timeline: new Date('2026-07-31T23:59:59.999Z'),
    status: 'draft',
    currentStep: 1,
    paymentStatus: 'unpaid',
    approvedAt: null,
    update: jest.fn().mockResolvedValue(undefined),
    $set: jest.fn().mockResolvedValue(undefined),
    setDataValue: jest.fn(),
    paymentBreakdown: {
      campaignBudget: 3000000,
      trenduppFee: 450000,
      vat: 225000,
      totalToPay: 3675000,
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
    } as unknown as jest.Mocked<CampaignRepository>;

    s3ServiceMock = {
      uploadFile: jest.fn().mockResolvedValue('https://mock-s3-url.com/image.jpg'),
    } as unknown as jest.Mocked<S3Service>;

    urlValidatorMock = {
      validateUrl: jest
        .fn()
        .mockResolvedValue({ isLive: true, platform: 'YouTube', checkedAt: new Date() }),
    } as unknown as jest.Mocked<UrlValidatorService>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: UrlValidatorService, useValue: urlValidatorMock },
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
        creatorCategoryId: 'cc1',
        preferredPlatformIds: ['p1'],
        timeline: '2026-07-31T23:59:59.999Z',
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
        brandId: 'b1',
        coverImage: undefined,
        status: 'draft',
        currentStep: 1,
        paymentStatus: 'unpaid',
        timeline: new Date('2026-07-31T23:59:59.999Z'),
        creatorNicheId: 'n1',
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
        creatorCategoryId: 'cc1',
        preferredPlatformIds: ['p1'],
        timeline: '2026-07-31T23:59:59.999Z',
        creatorNicheId: 'n1',
      };

      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      campaignRepoMock.create.mockResolvedValue(mockCampaign);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);

      await service.create('b1', createData, mockFile);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(s3ServiceMock.uploadFile).toHaveBeenCalledWith(mockFile);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.create).toHaveBeenCalledWith({
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        creatorCategoryId: 'cc1',
        brandId: 'b1',
        coverImage: 'https://mock-s3-url.com/image.jpg',
        status: 'draft',
        currentStep: 1,
        paymentStatus: 'unpaid',
        timeline: new Date('2026-07-31T23:59:59.999Z'),
        creatorNicheId: 'n1',
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
        successLooksLike: 'very good',
        campaignBrief: 'our brand guidelines brief',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(completeCampaign);

      const result = await service.submit('c1', 'b1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(completeCampaign.update).toHaveBeenCalledWith({
        status: 'submitted',
        currentStep: 5,
        acceptedTerms: true,
      });

      expect(result).toEqual({
        campaign: completeCampaign,
        payment: {
          campaignId: 'c1',
          amount: 3000000,
          totalAmount: 3675000,
          paymentStatus: 'unpaid',
        },
      });
    });
  });

  describe('pay', () => {
    it('should create payment and update status to paid', async () => {
      const submittedCampaign = {
        ...mockCampaign,
        id: 'c1',
        brandId: 'b1',
        status: 'pending_approval',
        paymentStatus: 'unpaid',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(submittedCampaign);
      campaignRepoMock.createPayment.mockResolvedValue({ id: 'pay1' } as any);

      await service.pay('c1', 'b1', 'tx_ref_123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createPayment).toHaveBeenCalledWith({
        campaignId: 'c1',
        amount: 3000000,
        totalAmount: 3675000,
        paymentStatus: 'paid',
        paymentReference: 'tx_ref_123',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(submittedCampaign.update).toHaveBeenCalledWith({
        paymentStatus: 'paid',
        status: 'live',
      });
    });
  });

  describe('findAll', () => {
    it('should delegate to campaignRepository.findAll', async () => {
      const mockResult = {
        data: [mockCampaign],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      campaignRepoMock.findAll.mockResolvedValue(mockResult);

      const query: FindAllCampaignsQueryDto = { status: 'live', sortBy: 'highest_budget' };
      const result = await service.findAll(query);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findAll).toHaveBeenCalledWith(query);
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
      pastWorkLink: 'https://instagram.com/p/example',
      primaryPlatformId: 'p1',
      secondaryPlatformId: 'p2',
      feeRequest: 150000,
      comments: 'Looking forward to this!',
    };

    it('should successfully submit an application for a live campaign', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      const mockApplication = { id: 'app1', ...mockAppDto };

      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
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

    it('should throw ForbiddenException if creator has already applied', async () => {
      const liveCampaign = { ...mockCampaign, status: 'live' } as unknown as Campaign;
      campaignRepoMock.findById.mockResolvedValue(liveCampaign);
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

      expect(mockApp.update).toHaveBeenCalledWith({ status: 'accepted' });
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

    it('should throw ForbiddenException if brand tries to request revision on revision-sent submission', async () => {
      const mockCampaignVal = { id: 'c1', brandId: 'brand1' };
      const mockSubmission = { id: 'sub1', campaignId: 'c1', status: 'revision-sent' };
      campaignRepoMock.findById.mockResolvedValue(mockCampaignVal as any);
      campaignRepoMock.findSubmissionById.mockResolvedValue(mockSubmission as any);

      await expect(
        service.vetDraft('c1', 'sub1', 'brand1', 'request_revision', 'More revisions'),
      ).rejects.toThrow(ForbiddenException);
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

      urlValidatorMock.validateUrl.mockResolvedValue({
        isLive: true,
        platform: 'Instagram',
        checkedAt: new Date('2026-06-29'),
      });

      await service.submitLivePost('c1', 'sub1', 'creator1', {
        instagram: 'https://instagram.com/p/live',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(urlValidatorMock.validateUrl).toHaveBeenCalledWith('https://instagram.com/p/live');

      expect(mockSubmission.update).toHaveBeenCalledWith({
        liveLink: {
          instagram: {
            url: 'https://instagram.com/p/live',
            isLive: true,
            checkedAt: expect.any(Date) as Date,
          },
        },
        urlIsLive: true,
        urlCheckedAt: expect.any(Date) as Date,
        status: 'done',
      });

      expect(mockApplication.update).toHaveBeenCalledWith({ status: 'approved' });
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
});
