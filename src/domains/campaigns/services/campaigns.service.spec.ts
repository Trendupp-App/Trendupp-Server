import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { CampaignRepository } from '../repository/campaign.repository';
import { Campaign } from '../entities/campaign.entity';
import { S3Service } from '../../../integration/s3/s3.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let s3ServiceMock: jest.Mocked<S3Service>;

  const mockCampaign = {
    id: 'c1',
    brandId: 'b1',
    title: 'Summer Campaign',
    goal: 'Create Content',
    totalBudget: 3000000,
    paymentPerCreator: '80,000 - 150,000',
    creatorCategoryId: 'cc1',
    contentType: 'Video',
    duration: 15,
    status: 'pending_approval',
    approvedAt: null,
    $set: jest.fn().mockResolvedValue(undefined),
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
    } as unknown as jest.Mocked<CampaignRepository>;

    s3ServiceMock = {
      uploadFile: jest.fn().mockResolvedValue('https://mock-s3-url.com/image.jpg'),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: S3Service, useValue: s3ServiceMock },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a campaign with pending_approval status and re-fetch it', async () => {
      const createData = {
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        paymentPerCreator: '80,000 - 150,000',
        creatorCategoryId: 'cc1',
        preferredPlatformIds: ['p1'],
        contentType: 'Video',
        duration: 15,
      };

      campaignRepoMock.create.mockResolvedValue(mockCampaign);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);

      const result = await service.create('b1', createData);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.create).toHaveBeenCalledWith({
        title: 'Summer Campaign',
        goal: 'Create Content',
        totalBudget: 3000000,
        paymentPerCreator: '80,000 - 150,000',
        creatorCategoryId: 'cc1',
        contentType: 'Video',
        duration: 15,
        brandId: 'b1',
        coverImage: undefined,
        status: 'pending_approval',
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
        paymentPerCreator: '80,000 - 150,000',
        creatorCategoryId: 'cc1',
        preferredPlatformIds: ['p1'],
        contentType: 'Video',
        duration: 15,
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
        paymentPerCreator: '80,000 - 150,000',
        creatorCategoryId: 'cc1',
        contentType: 'Video',
        duration: 15,
        brandId: 'b1',
        coverImage: 'https://mock-s3-url.com/image.jpg',
        status: 'pending_approval',
      });
    });
  });

  describe('findAll', () => {
    it('should delegate to campaignRepository.findAll', async () => {
      const mockCampaigns = [mockCampaign];
      campaignRepoMock.findAll.mockResolvedValue(mockCampaigns);

      const result = await service.findAll();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockCampaigns);
    });
  });

  describe('findById', () => {
    it('should return a campaign when found', async () => {
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);

      const result = await service.findById('c1');

      expect(result).toEqual(mockCampaign);
    });

    it('should throw NotFoundException when campaign is not found', async () => {
      campaignRepoMock.findById.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByBrandId', () => {
    it('should delegate to campaignRepository.findByBrandId', async () => {
      campaignRepoMock.findByBrandId.mockResolvedValue([mockCampaign]);

      const result = await service.findByBrandId('b1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findByBrandId).toHaveBeenCalledWith('b1');
      expect(result).toEqual([mockCampaign]);
    });
  });

  describe('findLive', () => {
    it('should delegate to campaignRepository.findLiveCampaigns', async () => {
      campaignRepoMock.findLiveCampaigns.mockResolvedValue([]);

      const result = await service.findLive();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findLiveCampaigns).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('findPast', () => {
    it('should delegate to campaignRepository.findPastCampaigns', async () => {
      campaignRepoMock.findPastCampaigns.mockResolvedValue([]);

      const result = await service.findPast();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findPastCampaigns).toHaveBeenCalled();
      expect(result).toEqual([]);
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
        status: 'live',
        approvedAt: new Date(),
      } as unknown as Campaign;

      campaignRepoMock.findById.mockResolvedValue(pendingCampaign);
      campaignRepoMock.updateStatus.mockResolvedValue(approvedCampaign);

      const result = await service.approve('c1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.updateStatus).toHaveBeenCalledWith(
        'c1',
        'live',
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
});
