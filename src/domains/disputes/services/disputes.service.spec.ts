import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from './disputes.service';
import { Dispute } from '../entities/dispute.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { PaymentRelease } from '../../campaigns/entities/payment-release.entity';
import { CampaignRefund } from '../../campaigns/entities/campaign-refund.entity';
import { StreamService } from '../../../integration/stream/stream.service';
import { DisputeRepository } from '../repository/dispute.repository';
import { CampaignRepository } from '../../campaigns/repository/campaign.repository';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { TimelineService } from '../../campaigns/services/timeline.service';

describe('DisputesService', () => {
  let service: DisputesService;
  let disputeRepoMock: jest.Mocked<DisputeRepository>;
  let campaignRepoMock: jest.Mocked<CampaignRepository>;
  let streamServiceMock: jest.Mocked<StreamService>;
  let notificationsServiceMock: jest.Mocked<NotificationsService>;

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
      findReleaseByCampaignAndCreator: jest.fn(),
      findSubmissionByCampaignAndCreator: jest.fn(),
      findApplicationByCampaignAndCreator: jest.fn(),
      createPaymentRelease: jest.fn(),
      createRefund: jest.fn(),
      findPaymentByCampaignId: jest.fn(),
    } as unknown as jest.Mocked<CampaignRepository>;

    streamServiceMock = {
      generateUserToken: jest.fn(),
      getApiKey: jest.fn(),
      createChannel: jest.fn(),
      freezeChannel: jest.fn(),
      upsertUser: jest.fn(),
      upsertUsers: jest.fn(),
    } as unknown as jest.Mocked<StreamService>;

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        TimelineService,
        { provide: DisputeRepository, useValue: disputeRepoMock },
        { provide: CampaignRepository, useValue: campaignRepoMock },
        { provide: StreamService, useValue: streamServiceMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
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
      streamServiceMock.upsertUser.mockResolvedValue(null);

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
      const mockRelease = {
        id: 'rel1',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as PaymentRelease;
      campaignRepoMock.findReleaseByCampaignAndCreator.mockResolvedValue(mockRelease);

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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRelease.update).toHaveBeenCalledWith({
        status: 'disputed',
        errorDetails: 'Creator raised a dispute: poor quality',
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
      const mockRelease = {
        id: 'rel1',
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as PaymentRelease;
      campaignRepoMock.findReleaseByCampaignAndCreator.mockResolvedValue(mockRelease);

      const result = await service.raiseDispute('brand1', 'brand', dto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(disputeRepoMock.create).toHaveBeenCalledWith({
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'raised',
        reason: 'empty submission',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRelease.update).toHaveBeenCalledWith({
        status: 'disputed',
        errorDetails: 'Brand raised a dispute: empty submission',
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
    it('should resolve under_review dispute, freeze GetStream channel, and release to creator if release exists', async () => {
      const originalReleaseDate = new Date();
      const dispute = {
        id: 'disp1',
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'under_review',
        streamChannelId: 'dispute_disp1',
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dispute;

      const mockRelease = {
        id: 'rel1',
        amount: 100000,
        releaseDate: originalReleaseDate,
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as PaymentRelease;

      disputeRepoMock.findById.mockResolvedValue(dispute);
      streamServiceMock.freezeChannel.mockResolvedValue(undefined);

      campaignRepoMock.findReleaseByCampaignAndCreator.mockResolvedValue(mockRelease);

      const result = await service.resolveDispute('disp1', 'admin1', {
        action: 'release_to_creator',
        resolutionNotes: 'Release escrow to creator',
      });

      expect(dispute.status).toBe('resolved');
      expect(dispute.escrowAction).toBe('release_to_creator');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRelease.update).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const updateMock1 = mockRelease.update as jest.Mock;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstCallArg1 = updateMock1.mock.calls[0][0] as {
        status: string;
        errorDetails: string;
      };
      expect(firstCallArg1.status).toBe('pending');
      expect(firstCallArg1.errorDetails).toContain('Dispute resolved in favor of Creator');
      expect(result).toBe(dispute);
    });

    it('should resolve dispute and refund to brand using creator original release date if release exists', async () => {
      const originalReleaseDate = new Date();
      const dispute = {
        id: 'disp1',
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'under_review',
        streamChannelId: 'dispute_disp1',
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dispute;

      const mockRelease = {
        id: 'rel1',
        amount: 100000,
        releaseDate: originalReleaseDate,
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as PaymentRelease;

      const mockCampaign = {
        id: 'camp1',
        currency: 'NGN',
      } as unknown as Campaign;

      disputeRepoMock.findById.mockResolvedValue(dispute);
      streamServiceMock.freezeChannel.mockResolvedValue(undefined);

      campaignRepoMock.findReleaseByCampaignAndCreator.mockResolvedValue(mockRelease);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);
      campaignRepoMock.createRefund.mockResolvedValue({} as any as CampaignRefund);

      await service.resolveDispute('disp1', 'admin1', {
        action: 'refund_to_brand',
        resolutionNotes: 'Refund to brand',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRelease.update).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const updateMock2 = mockRelease.update as jest.Mock;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstCallArg2 = updateMock2.mock.calls[0][0] as {
        status: string;
        errorDetails: string;
      };
      expect(firstCallArg2.status).toBe('cancelled');
      expect(firstCallArg2.errorDetails).toContain('Dispute resolved in favor of Brand');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createRefund).toHaveBeenCalledWith({
        campaignId: 'camp1',
        brandId: 'brand1',
        amount: 100000,
        status: 'pending',
        currency: 'NGN',
        releaseDate: originalReleaseDate,
      });
    });

    it('should resolve dispute and split escrow 50/50 using creator original release date if release exists', async () => {
      const originalReleaseDate = new Date();
      const dispute = {
        id: 'disp1',
        campaignId: 'camp1',
        creatorId: 'creator1',
        brandId: 'brand1',
        status: 'under_review',
        streamChannelId: 'dispute_disp1',
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as Dispute;

      const mockRelease = {
        id: 'rel1',
        amount: 100000,
        releaseDate: originalReleaseDate,
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as PaymentRelease;

      const mockCampaign = {
        id: 'camp1',
        currency: 'NGN',
      } as unknown as Campaign;

      disputeRepoMock.findById.mockResolvedValue(dispute);
      streamServiceMock.freezeChannel.mockResolvedValue(undefined);

      campaignRepoMock.findReleaseByCampaignAndCreator.mockResolvedValue(mockRelease);
      campaignRepoMock.findById.mockResolvedValue(mockCampaign);
      campaignRepoMock.createRefund.mockResolvedValue({} as any as CampaignRefund);

      await service.resolveDispute('disp1', 'admin1', {
        action: 'split',
        resolutionNotes: 'Split 50/50',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockRelease.update).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const updateMock3 = mockRelease.update as jest.Mock;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const firstCallArg3 = updateMock3.mock.calls[0][0] as {
        amount: number;
        status: string;
        errorDetails: string;
      };
      expect(firstCallArg3.amount).toBe(50000);
      expect(firstCallArg3.status).toBe('pending');
      expect(firstCallArg3.errorDetails).toContain('Dispute resolved via 50/50 split');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(campaignRepoMock.createRefund).toHaveBeenCalledWith({
        campaignId: 'camp1',
        brandId: 'brand1',
        amount: 50000,
        status: 'pending',
        currency: 'NGN',
        releaseDate: originalReleaseDate,
      });
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
