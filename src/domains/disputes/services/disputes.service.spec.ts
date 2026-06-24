import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from './disputes.service';
import { Dispute } from '../entities/dispute.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { StreamService } from '../../../integration/stream/stream.service';
import { DisputeRepository } from '../repository/dispute.repository';
import { CampaignRepository } from '../../campaigns/repository/campaign.repository';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('DisputesService', () => {
  let service: DisputesService;
  let disputeRepoMock: jest.Mocked<DisputeRepository>;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let streamServiceMock: jest.Mocked<StreamService>;

  beforeEach(async () => {
    disputeRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdWithCampaign: jest.fn(),
      findOneActive: jest.fn(),
      findAllWithCampaign: jest.fn(),
      findAllByCreator: jest.fn(),
      findAllByBrand: jest.fn(),
    } as unknown as jest.Mocked<DisputeRepository>;

    campaignRepoMock = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<CampaignRepository>;

    streamServiceMock = {
      generateUserToken: jest.fn(),
      getApiKey: jest.fn(),
      createChannel: jest.fn(),
      freezeChannel: jest.fn(),
      upsertUser: jest.fn(),
      upsertUsers: jest.fn(),
    } as unknown as jest.Mocked<StreamService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: DisputeRepository, useValue: disputeRepoMock },
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: StreamService, useValue: streamServiceMock },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStreamToken', () => {
    it('should generate token using StreamService', async () => {
      streamServiceMock.generateUserToken.mockReturnValue('mock_token');
      streamServiceMock.getApiKey.mockReturnValue('mock_api_key');
      streamServiceMock.upsertUser.mockResolvedValue(undefined);

      const result = await service.getStreamToken({
        id: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.upsertUser).toHaveBeenCalledWith({
        id: 'user1',
        name: 'John Doe',
        image: undefined,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.generateUserToken).toHaveBeenCalledWith('user1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.getApiKey).toHaveBeenCalled();
      expect(result).toEqual({ token: 'mock_token', apiKey: 'mock_api_key' });
    });
  });

  describe('raiseDispute', () => {
    it('should raise dispute for creator successfully', async () => {
      const dto = { campaignId: 'camp1', reason: 'poor quality' };
      const campaign = { id: 'camp1', brandId: 'brand1' } as Campaign;

      campaignRepoMock.findById.mockResolvedValue(campaign);
      disputeRepoMock.findOneActive.mockResolvedValue(null);
      disputeRepoMock.create.mockImplementation((data: any) =>
        Promise.resolve({ id: 'disp1', ...data } as Dispute),
      );

      const result = await service.raiseDispute('creator1', 'creator', dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.findById).toHaveBeenCalledWith('camp1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(disputeRepoMock.create).toHaveBeenCalledWith({
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'raised',
        reason: 'poor quality',
      });
      expect(result.status).toBe('raised');
    });

    it('should raise dispute for brand successfully when creatorId is specified', async () => {
      const dto = { campaignId: 'camp1', reason: 'empty submission', creatorId: 'creator1' };
      const campaign = { id: 'camp1', brandId: 'brand1' } as Campaign;

      campaignRepoMock.findById.mockResolvedValue(campaign);
      disputeRepoMock.findOneActive.mockResolvedValue(null);
      disputeRepoMock.create.mockImplementation((data: any) =>
        Promise.resolve({ id: 'disp1', ...data } as Dispute),
      );

      const result = await service.raiseDispute('brand1', 'brand', dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(disputeRepoMock.create).toHaveBeenCalledWith({
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'raised',
        reason: 'empty submission',
      });
      expect(result.status).toBe('raised');
    });

    it('should throw ForbiddenException if user is not creator or brand', async () => {
      const dto = { campaignId: 'camp1', reason: 'bad text' };
      campaignRepoMock.findById.mockResolvedValue({ id: 'camp1' } as Campaign);

      await expect(service.raiseDispute('admin1', 'admin', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if active dispute already exists', async () => {
      const dto = { campaignId: 'camp1', reason: 'some reason' };
      campaignRepoMock.findById.mockResolvedValue({ id: 'camp1', brandId: 'brand1' } as Campaign);
      disputeRepoMock.findOneActive.mockResolvedValue({ id: 'disp1' } as Dispute);

      await expect(service.raiseDispute('creator1', 'creator', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activateDispute', () => {
    it('should activate raised dispute and create GetStream channel', async () => {
      const dispute = {
        id: 'disp1',
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'raised',
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dispute;

      disputeRepoMock.findById.mockResolvedValue(dispute);
      streamServiceMock.upsertUsers.mockResolvedValue(undefined);
      streamServiceMock.createChannel.mockResolvedValue(undefined);

      const result = await service.activateDispute('disp1', 'admin1', {
        financeAdminId: 'finance1',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.upsertUsers).toHaveBeenCalledWith([
        'creator1',
        'brand1',
        'admin1',
        'finance1',
      ]);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.createChannel).toHaveBeenCalledWith(
        'dispute',
        'dispute_disp1',
        'Dispute - Campaign #camp1',
        ['creator1', 'brand1', 'admin1', 'finance1'],
        'admin1',
      );
      expect(dispute.status).toBe('under_review');
      expect(dispute.streamChannelId).toBe('dispute_disp1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dispute.save).toHaveBeenCalled();
      expect(result).toBe(dispute);
    });

    it('should throw BadRequestException if dispute is resolved', async () => {
      const dispute = { id: 'disp1', status: 'resolved' } as Dispute;
      disputeRepoMock.findById.mockResolvedValue(dispute);

      await expect(
        service.activateDispute('disp1', 'admin1', { financeAdminId: undefined }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve under_review dispute and freeze GetStream channel', async () => {
      const dispute = {
        id: 'disp1',
        status: 'under_review',
        streamChannelId: 'dispute_disp1',
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dispute;

      disputeRepoMock.findById.mockResolvedValue(dispute);
      streamServiceMock.freezeChannel.mockResolvedValue(undefined);

      const result = await service.resolveDispute('disp1', 'admin1', {
        action: 'release_to_creator',
        resolutionNotes: 'Release escrow',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(streamServiceMock.freezeChannel).toHaveBeenCalledWith('dispute', 'dispute_disp1');
      expect(dispute.status).toBe('resolved');
      expect(dispute.escrowAction).toBe('release_to_creator');
      expect(dispute.resolvedById).toBe('admin1');
      expect(dispute.resolutionNotes).toBe('Release escrow');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dispute.save).toHaveBeenCalled();
      expect(result).toBe(dispute);
    });
  });

  describe('getDispute', () => {
    it('should return dispute details if user is a participant', async () => {
      const dispute = { creatorId: 'creator1', brandId: 'brand1' } as Dispute;
      disputeRepoMock.findByIdWithCampaign.mockResolvedValue(dispute);

      const result = await service.getDispute('disp1', 'creator1', 'creator');

      expect(result).toBe(dispute);
    });

    it('should throw ForbiddenException if user is not associated or not admin', async () => {
      const dispute = { creatorId: 'creator1', brandId: 'brand1' } as Dispute;
      disputeRepoMock.findByIdWithCampaign.mockResolvedValue(dispute);

      await expect(service.getDispute('disp1', 'other_user', 'creator')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
