import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes } from 'sequelize';
import { Dispute } from '../entities/dispute.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Lean user shape included in dispute GET responses — excludes sensitive fields
 * (password, tokens, bank details) while giving the consumer enough context to
 * display a name/avatar next to each audit action.
 */
const AUDIT_USER_ATTRS: (keyof User)[] = ['id', 'firstName', 'lastName', 'avatarUrl'];

/** Associations loaded on every GET dispute query */
const DISPUTE_INCLUDES = [
  'campaign',
  { association: 'activatedBy', attributes: AUDIT_USER_ATTRS },
  { association: 'resolvedBy', attributes: AUDIT_USER_ATTRS },
];

@Injectable()
export class DisputeRepository {
  constructor(
    @InjectModel(Dispute)
    private readonly disputeModel: typeof Dispute,
  ) {}

  async create(data: Partial<Attributes<Dispute>>): Promise<Dispute> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.disputeModel as any).create(data) as Promise<Dispute>;
  }

  async findById(id: string): Promise<Dispute | null> {
    return this.disputeModel.findByPk(id);
  }

  async findByIdWithCampaign(id: string): Promise<Dispute | null> {
    return this.disputeModel.findByPk(id, {
      include: DISPUTE_INCLUDES,
    });
  }

  async findOneActive(
    campaignId: string,
    creatorId: string,
    brandId: string,
  ): Promise<Dispute | null> {
    return this.disputeModel.findOne({
      where: {
        campaignId,
        creatorId,
        brandId,
        status: ['raised', 'under_review'],
      },
    });
  }

  async findAllWithCampaign(): Promise<Dispute[]> {
    return this.disputeModel.findAll({
      include: DISPUTE_INCLUDES,
      order: [['createdAt', 'DESC']],
    });
  }

  async findAllByCreator(creatorId: string): Promise<Dispute[]> {
    return this.disputeModel.findAll({
      where: { creatorId },
      include: DISPUTE_INCLUDES,
      order: [['createdAt', 'DESC']],
    });
  }

  async findAllByBrand(brandId: string): Promise<Dispute[]> {
    return this.disputeModel.findAll({
      where: { brandId },
      include: DISPUTE_INCLUDES,
      order: [['createdAt', 'DESC']],
    });
  }
}
