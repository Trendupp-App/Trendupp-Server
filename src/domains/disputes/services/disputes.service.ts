import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Dispute } from '../entities/dispute.entity';
import { StreamService } from '../../../integration/stream/stream.service';
import { DisputeRepository } from '../repository/dispute.repository';
import { CampaignRepository } from '../../campaigns/repository/campaign.repository';
import { CreateDisputeDto } from '../dtos/create-dispute.dto';
import { ActivateDisputeDto } from '../dtos/activate-dispute.dto';
import { ResolveDisputeDto } from '../dtos/resolve-dispute.dto';

@Injectable()
export class DisputesService {
  constructor(
    private readonly disputeRepository: DisputeRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly streamService: StreamService,
  ) {}

  getStreamToken(userId: string) {
    const token = this.streamService.generateUserToken(userId);
    const apiKey = this.streamService.getApiKey();
    return { token, apiKey };
  }

  async raiseDispute(userId: string, role: string, dto: CreateDisputeDto): Promise<Dispute> {
    const campaign = await this.campaignRepository.findById(dto.campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    let creatorId: string;
    let brandId: string;

    if (role === 'creator') {
      creatorId = userId;
      brandId = campaign.brandId;
    } else if (role === 'brand') {
      if (campaign.brandId !== userId) {
        throw new ForbiddenException('You do not own this campaign');
      }
      if (!dto.creatorId) {
        throw new BadRequestException('creatorId is required when a brand escalates a dispute');
      }
      creatorId = dto.creatorId;
      brandId = userId;
    } else {
      throw new ForbiddenException('Only creators or brands can raise campaign disputes');
    }

    // Check for existing active dispute to avoid duplicate runs
    const existing = await this.disputeRepository.findOneActive(dto.campaignId, creatorId, brandId);

    if (existing) {
      throw new BadRequestException(
        'An active dispute already exists for this campaign and participants',
      );
    }

    return this.disputeRepository.create({
      campaignId: dto.campaignId,
      creatorId,
      brandId,
      status: 'raised',
      reason: dto.reason,
    });
  }

  async activateDispute(id: string, adminId: string, dto: ActivateDisputeDto): Promise<Dispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'raised') {
      throw new BadRequestException(
        `Dispute cannot be activated. Current status is: ${dispute.status}`,
      );
    }

    const memberIds = [dispute.creatorId, dispute.brandId, adminId];
    if (dto.financeAdminId) {
      memberIds.push(dto.financeAdminId);
    }

    // Create Stream channel
    await this.streamService.createChannel(
      'dispute',
      `dispute_${dispute.id}`,
      `Dispute - Campaign #${dispute.campaignId}`,
      memberIds,
      adminId,
    );

    dispute.status = 'under_review';
    dispute.streamChannelId = `dispute_${dispute.id}`;
    await dispute.save();

    return dispute;
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto): Promise<Dispute> {
    const dispute = await this.disputeRepository.findById(id);
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'under_review') {
      throw new BadRequestException(
        `Dispute cannot be resolved. Current status is: ${dispute.status}`,
      );
    }

    // Freeze Stream channel
    if (dispute.streamChannelId) {
      await this.streamService.freezeChannel('dispute', dispute.streamChannelId);
    }

    dispute.status = 'resolved';
    dispute.escrowAction = dto.action;
    dispute.resolvedAt = new Date();
    await dispute.save();

    return dispute;
  }

  async getDispute(id: string, userId: string, role: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.findByIdWithCampaign(id);

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const isAdmin = ['admin', 'super_admin', 'finance_admin'].includes(role);
    if (!isAdmin && dispute.creatorId !== userId && dispute.brandId !== userId) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    return dispute;
  }

  async listDisputes(userId: string, role: string): Promise<Dispute[]> {
    const isAdmin = ['admin', 'super_admin', 'finance_admin'].includes(role);

    if (isAdmin) {
      return this.disputeRepository.findAllWithCampaign();
    }

    if (role === 'creator') {
      return this.disputeRepository.findAllByCreator(userId);
    }

    return this.disputeRepository.findAllByBrand(userId);
  }
}
