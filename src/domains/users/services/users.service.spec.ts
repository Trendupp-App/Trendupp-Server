import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '../repository/user.repository';
import { User } from '../entities/user.entity';
import { RoleRepository } from '../repository/role.repository';
import { Role } from '../entities/role.entity';
import { CampaignReview } from '../../campaigns/entities/campaign-review.entity';

import { getModelToken } from '@nestjs/sequelize';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { paginate } from '../../../shared/utils/pagination.utils';

jest.mock('../../../shared/utils/pagination.utils', () => ({
  paginate: jest
    .fn()
    .mockImplementation(
      (model: unknown, options: unknown, pagination: { page?: number; limit?: number }) => {
        return Promise.resolve({
          data: [],
          pagination: {
            total: 0,
            page: pagination?.page || 1,
            limit: pagination?.limit || 10,
            pages: 0,
          },
        });
      },
    ),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepositoryMock: jest.Mocked<UserRepository>;
  let roleRepositoryMock: jest.Mocked<RoleRepository>;

  beforeEach(async () => {
    userRepositoryMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      findUsersByRole: jest.fn(),
      findProfileById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    roleRepositoryMock = {
      findByName: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: userRepositoryMock },
        { provide: RoleRepository, useValue: roleRepositoryMock },
        { provide: getModelToken(Campaign), useValue: {} },
      ],
    }).compile();

    jest.spyOn(CampaignReview, 'findAll').mockResolvedValue([]);

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to userRepository.findAll', async () => {
      const mockUsers = [{ id: 'u1' }, { id: 'u2' }] as unknown as User[];
      userRepositoryMock.findAll.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should delegate to userRepository.findById with the given id', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com' } as unknown as User;
      userRepositoryMock.findById.mockResolvedValue(mockUser);

      const result = await service.findOne('u1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findById).toHaveBeenCalledWith('u1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is found', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      const result = await service.findOne('missing-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should delegate to userRepository.findByEmail', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com' } as unknown as User;
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when the user is not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should delegate to userRepository.create and return the new user', async () => {
      const data = { email: 'new@example.com', firstName: 'Test', lastName: 'User' };
      const mockUser = { id: 'u-new', ...data } as unknown as User;
      userRepositoryMock.create.mockResolvedValue(mockUser);

      const result = await service.create(data);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockUser);
    });
  });

  describe('remove', () => {
    it('should delegate to userRepository.remove and return the affected count', async () => {
      userRepositoryMock.remove.mockResolvedValue(1);

      const result = await service.remove('u1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.remove).toHaveBeenCalledWith('u1');
      expect(result).toBe(1);
    });
  });

  describe('findRoleByName', () => {
    it('should delegate to roleRepository.findByName', async () => {
      const mockRole = { id: 'r1', name: 'creator' } as unknown as Role;
      roleRepositoryMock.findByName.mockResolvedValue(mockRole);

      const result = await service.findRoleByName('creator');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findByName).toHaveBeenCalledWith('creator');
      expect(result).toEqual(mockRole);
    });
  });

  describe('findRoleById', () => {
    it('should delegate to roleRepository.findById', async () => {
      const mockRole = { id: 'r1', name: 'creator' } as unknown as Role;
      roleRepositoryMock.findById.mockResolvedValue(mockRole);

      const result = await service.findRoleById('r1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findById).toHaveBeenCalledWith('r1');
      expect(result).toEqual(mockRole);
    });
  });

  describe('findAllRoles', () => {
    it('should delegate to roleRepository.findAll with default publicOnly=false', async () => {
      const mockRoles = [
        { id: 'r1', name: 'creator' },
        { id: 'r2', name: 'brand' },
      ] as unknown as Role[];
      roleRepositoryMock.findAll.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findAll).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockRoles);
    });

    it('should delegate to roleRepository.findAll with publicOnly=true', async () => {
      const mockRoles = [
        { id: 'r1', name: 'creator' },
        { id: 'r2', name: 'brand' },
      ] as unknown as Role[];
      roleRepositoryMock.findAll.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles(true);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findAll).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockRoles);
    });
  });

  describe('exploreUsers', () => {
    it('should query and return brand users with correct mappings', async () => {
      const mockRole = { id: 'r-brand', name: 'brand' } as unknown as Role;
      roleRepositoryMock.findByName.mockResolvedValue(mockRole);

      const mockUsers = [
        {
          id: 'u1',
          firstName: 'Zara',
          lastName: 'Africa',
          username: 'zara',
          instagramFollowers: 1000,
          tiktokFollowers: 2000,
          youtubeFollowers: 0,
          twitterFollowers: 0,
          industries: [{ id: 'ind1', name: 'Fashion' }],
          campaigns: [{ id: 'c1' }, { id: 'c2' }],
        },
      ] as unknown as User[];

      userRepositoryMock.findUsersByRole.mockResolvedValue(mockUsers);

      const result = await service.exploreUsers('brands', { category: 'Fashion' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findByName).toHaveBeenCalledWith('brand');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findUsersByRole).toHaveBeenCalledWith(
        'r-brand',
        { category: 'Fashion' },
        true,
      );
      expect(result).toEqual([
        {
          id: 'u1',
          firstName: 'Zara',
          lastName: 'Africa',
          username: 'zara',
          avatarUrl: undefined,
          bio: undefined,
          city: undefined,
          followersCount: 3000,
          industries: [{ id: 'ind1', name: 'Fashion' }],
          totalCampaigns: 2,
        },
      ]);
    });

    it('should query and return creator users with correct mappings', async () => {
      const mockRole = { id: 'r-creator', name: 'creator' } as unknown as Role;
      roleRepositoryMock.findByName.mockResolvedValue(mockRole);

      const mockUsers = [
        {
          id: 'u2',
          firstName: 'John',
          lastName: 'Doe',
          username: 'john',
          instagramFollowers: 500,
          tiktokFollowers: 0,
          youtubeFollowers: 0,
          twitterFollowers: 0,
          niches: [{ id: 'n1', name: 'Tech' }],
          assignedTier: 'Micro',
        },
      ] as unknown as User[];

      userRepositoryMock.findUsersByRole.mockResolvedValue(mockUsers);

      const result = await service.exploreUsers('creators', {});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findByName).toHaveBeenCalledWith('creator');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findUsersByRole).toHaveBeenCalledWith(
        'r-creator',
        { category: undefined },
        false,
      );
      expect(result).toEqual([
        {
          id: 'u2',
          firstName: 'John',
          lastName: 'Doe',
          username: 'john',
          avatarUrl: undefined,
          bio: undefined,
          city: undefined,
          followersCount: 500,
          niches: [{ id: 'n1', name: 'Tech' }],
          assignedTier: 'Micro',
          avgRating: null,
          totalReviews: 0,
        },
      ]);
    });
  });

  describe('exploreProfile', () => {
    it('should return a populated brand profile', async () => {
      const mockUser = {
        id: 'u1',
        email: 'brand@zara.com',
        firstName: 'Zara',
        lastName: 'Africa',
        username: 'zara',
        instagramUsername: 'zara_ig',
        instagramFollowers: 5000,
        role: { name: 'brand' },
        industries: [{ id: 'ind1', name: 'Fashion' }],
        campaigns: [
          {
            id: 'c1',
            title: 'Summer',
            goal: 'Promo',
            totalBudget: 1000,
            coverImage: 'img.png',
            status: 'live',
            timeline: new Date('2026-06-30'),
          },
        ],
        toJSON: () => ({
          state: { id: 's1', name: 'Lagos' },
          country: { id: 'c1', name: 'Nigeria' },
        }),
      } as unknown as User;

      userRepositoryMock.findProfileById.mockResolvedValue(mockUser);

      const result = await service.exploreProfile('u1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findProfileById).toHaveBeenCalledWith('u1');
      expect(result).toEqual({
        id: 'u1',
        email: 'brand@zara.com',
        firstName: 'Zara',
        lastName: 'Africa',
        username: 'zara',
        avatarUrl: undefined,
        bio: undefined,
        city: undefined,
        state: { id: 's1', name: 'Lagos' },
        country: { id: 'c1', name: 'Nigeria' },
        role: 'brand',
        platforms: {
          instagram: { username: 'zara_ig', followers: 5000 },
        },
        industries: [{ id: 'ind1', name: 'Fashion' }],
        campaigns: [
          {
            id: 'c1',
            title: 'Summer',
            goal: 'Promo',
            totalBudget: 1000,
            coverImage: 'img.png',
            status: 'live',
            timeline: new Date('2026-06-30'),
          },
        ],
      });
    });

    it('should return a populated creator profile with reviews and ratings', async () => {
      const mockUser = {
        id: 'creator1',
        email: 'creator@trendupp.com',
        firstName: 'Creator',
        lastName: 'One',
        username: 'creator1',
        tiktokUsername: 'creator1_tt',
        tiktokFollowers: 15000,
        role: { name: 'creator' },
        niches: [{ id: 'n1', name: 'Tech' }],
        assignedTier: 'Micro',
        avgRating: 4.85,
        totalReviews: 3,
        toJSON: () => ({
          state: { id: 's1', name: 'Lagos' },
          country: { id: 'c1', name: 'Nigeria' },
        }),
      } as unknown as User;

      userRepositoryMock.findProfileById.mockResolvedValue(mockUser);

      const mockReviews = [
        {
          id: 'r1',
          starRating: 5,
          comment: 'Perfect delivery!',
          createdAt: new Date('2026-07-01'),
          brand: {
            id: 'brand1',
            firstName: 'Zara',
            lastName: 'Africa',
            username: 'zara',
            avatarUrl: 'http://img.jpg',
          },
        },
      ];

      jest
        .spyOn(CampaignReview, 'findAll')
        .mockResolvedValue(mockReviews as unknown as CampaignReview[]);

      const result = await service.exploreProfile('creator1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findProfileById).toHaveBeenCalledWith('creator1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(CampaignReview.findAll).toHaveBeenCalledWith({
        where: { creatorId: 'creator1' },
        include: [
          {
            model: User,
            as: 'brand',
            attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      expect(result).toEqual({
        id: 'creator1',
        email: 'creator@trendupp.com',
        firstName: 'Creator',
        lastName: 'One',
        username: 'creator1',
        avatarUrl: undefined,
        bio: undefined,
        city: undefined,
        state: { id: 's1', name: 'Lagos' },
        country: { id: 'c1', name: 'Nigeria' },
        role: 'creator',
        platforms: {
          tiktok: { username: 'creator1_tt', followers: 15000 },
        },
        niches: [{ id: 'n1', name: 'Tech' }],
        assignedTier: 'Micro',
        avgRating: 4.85,
        totalReviews: 3,
        reviews: [
          {
            id: 'r1',
            starRating: 5,
            comment: 'Perfect delivery!',
            createdAt: new Date('2026-07-01'),
            brand: {
              id: 'brand1',
              firstName: 'Zara',
              lastName: 'Africa',
              username: 'zara',
              avatarUrl: 'http://img.jpg',
            },
          },
        ],
      });
    });
  });

  describe('unifiedSearch', () => {
    it('should search campaigns, creators, and brands and return grouped paginated results', async () => {
      roleRepositoryMock.findByName.mockImplementation((name: string) => {
        if (name === 'creator') return Promise.resolve({ id: 'role_creator' } as Role);
        if (name === 'brand') return Promise.resolve({ id: 'role_brand' } as Role);
        return Promise.resolve(null);
      });

      const mockCampaign = { id: 'camp1', title: 'Fashion Campaign', status: 'live' };
      const mockCreator = {
        id: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        username: 'jdoe',
        instagramFollowers: 10000,
        niches: [{ id: 'n1', name: 'Fashion' }],
      };
      const mockBrand = {
        id: 'brand1',
        firstName: 'Zara',
        lastName: 'Corp',
        username: 'zara',
        industries: [{ id: 'i1', name: 'Clothing' }],
      };

      // Mock paginate to return different values depending on options.where details
      (paginate as jest.Mock).mockImplementation(
        (model: unknown, options: { where?: { status?: string; roleId?: string } }) => {
          if (options?.where?.status === 'live') {
            return Promise.resolve({
              data: [mockCampaign],
              pagination: { total: 1, page: 1, limit: 10, pages: 1 },
            });
          }
          if (options?.where?.roleId === 'role_creator') {
            return Promise.resolve({
              data: [mockCreator],
              pagination: { total: 1, page: 1, limit: 10, pages: 1 },
            });
          }
          return Promise.resolve({
            data: [mockBrand],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 },
          });
        },
      );

      const result = await service.unifiedSearch({ q: 'Fashion', page: 1, limit: 10 });

      expect(result).toHaveProperty('campaigns');
      expect(result).toHaveProperty('creators');
      expect(result).toHaveProperty('brands');

      expect(result.campaigns.data).toContainEqual(mockCampaign);
      expect(result.creators.data[0]).toMatchObject({
        id: 'user1',
        followersCount: 10000,
      });
    });
  });
});
