import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Campaign } from '../entities/campaign.entity';
import { CampaignRepository } from '../repository/campaign.repository';
import { S3Service } from '../../../integration/s3/s3.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    brandId: string,
    data: {
      title: string;
      goal: string;
      totalBudget: number;
      paymentPerCreator: string;
      creatorCategoryId: string;
      preferredPlatformIds: string[];
      contentType: string;
      duration: number;
      contentDuration?: string;
      contentGuidelines?: string;
      campaignRules?: string;
    },
    file?: Express.Multer.File,
  ): Promise<Campaign> {
    let coverImage: string | undefined;
    if (file) {
      coverImage = await this.s3Service.uploadFile(file);
    }

    const { preferredPlatformIds, ...campaignData } = data;

    const campaign = await this.campaignRepository.create({
      ...campaignData,
      brandId,
      coverImage,
      status: 'pending_approval',
    });

    if (preferredPlatformIds && preferredPlatformIds.length > 0) {
      await campaign.$set('preferredPlatforms', preferredPlatformIds);
    }

    const populated = await this.campaignRepository.findById(campaign.id);
    return populated!;
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignRepository.findAll();
  }

  async findById(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${id}" not found`);
    }
    return campaign;
  }

  findByBrandId(brandId: string): Promise<Campaign[]> {
    return this.campaignRepository.findByBrandId(brandId);
  }

  findLive(): Promise<Campaign[]> {
    return this.campaignRepository.findLiveCampaigns();
  }

  findPast(): Promise<Campaign[]> {
    return this.campaignRepository.findPastCampaigns();
  }

  /**
   * Approve a pending campaign — sets status to 'live' and stamps approvedAt.
   * Only campaigns in 'pending_approval' status can be approved.
   */
  async approve(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID "${campaignId}" not found`);
    }

    if (campaign.status !== 'pending_approval') {
      throw new ForbiddenException(
        `Campaign is already "${campaign.status}" and cannot be approved`,
      );
    }

    const updated = await this.campaignRepository.updateStatus(campaignId, 'live', new Date());
    return updated!;
  }
}
