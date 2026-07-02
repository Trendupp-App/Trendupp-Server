import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { CampaignRepository } from './campaign.repository';
import { Campaign } from '../entities/campaign.entity';
import { CreatorCategory } from '../entities/creator-category.entity';
import { Platform } from '../entities/platform.entity';
import { Payment } from '../entities/payment.entity';
import { CampaignApplication } from '../entities/campaign-application.entity';
import { ContentSubmission } from '../entities/content-submission.entity';
import { Fee } from '../entities/fee.entity';
import { CampaignReview } from '../entities/campaign-review.entity';
import { paginate } from '../../../shared/utils/pagination.utils';
import { Op } from 'sequelize';

jest.mock('../../../shared/utils/pagination.utils', () => ({
  paginate: jest.fn().mockResolvedValue({
    data: [],
    pagination: { total: 0, page: 1, limit: 10, pages: 0 },
  }),
}));

describe('CampaignRepository', () => {
  let repository: CampaignRepository;
  let campaignModelMock: Record<string, unknown>;

  beforeEach(async () => {
    campaignModelMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignRepository,
        { provide: getModelToken(Campaign), useValue: campaignModelMock },
        { provide: getModelToken(CreatorCategory), useValue: {} },
        { provide: getModelToken(Platform), useValue: {} },
        { provide: getModelToken(Payment), useValue: {} },
        { provide: getModelToken(CampaignApplication), useValue: {} },
        { provide: getModelToken(ContentSubmission), useValue: {} },
        { provide: getModelToken(Fee), useValue: {} },
        { provide: getModelToken(CampaignReview), useValue: {} },
      ],
    }).compile();

    repository = module.get<CampaignRepository>(CampaignRepository);
    jest.clearAllMocks();
  });

  it('should construct correct where and order options in findAll', async () => {
    await repository.findAll({
      status: 'live',
      sortBy: 'highest_budget',
      platforms: ['Instagram', 'X'],
      niches: ['Fashion'],
      goal: 'Content Creation',
      page: 1,
      limit: 10,
    });

    expect(paginate).toHaveBeenCalledWith(
      campaignModelMock,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          status: 'live',
          goal: 'Create Content',
          '$preferredPlatforms.name$': {
            [Op.or]: [{ [Op.iLike]: 'Instagram' }, { [Op.iLike]: 'Twitter' }],
          },
          '$creatorNiche.name$': {
            [Op.or]: [{ [Op.iLike]: 'Fashion' }],
          },
        }),
        order: [['totalBudget', 'DESC']],
        distinct: true,
        subQuery: false,
      }),
      { page: 1, limit: 10 },
    );
  });
});
