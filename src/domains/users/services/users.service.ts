import { Injectable, NotFoundException } from '@nestjs/common';
import { Attributes, Op } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { RoleRepository } from '../repository/role.repository';
import { Role } from '../entities/role.entity';
import { Niche } from '../entities/niche.entity';
import { Industry } from '../entities/industry.entity';
import { CampaignReview } from '../../campaigns/entities/campaign-review.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { ExploreSearchQueryDto } from '../dtos/explore-search-query.dto';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  findOne(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findOneWithNiches(id: string): Promise<User | null> {
    return this.userRepository.findById(id, true);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  findByTiktokOpenId(tiktokOpenId: string): Promise<User | null> {
    return this.userRepository.findByTiktokOpenId(tiktokOpenId);
  }

  findByInstagramOpenId(instagramOpenId: string): Promise<User | null> {
    return this.userRepository.findByInstagramOpenId(instagramOpenId);
  }

  setUserNiches(id: string, nicheIds: string[]): Promise<void> {
    return this.userRepository.setUserNiches(id, nicheIds);
  }

  findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepository.findByName(name);
  }

  findRoleById(id: string): Promise<Role | null> {
    return this.roleRepository.findById(id);
  }

  findAllRoles(publicOnly = false): Promise<Role[]> {
    return this.roleRepository.findAll(publicOnly);
  }

  create(data: Partial<Attributes<User>>): Promise<User> {
    return this.userRepository.create(data);
  }

  async update(id: string, data: Partial<Attributes<User>>): Promise<User | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    await user.update(data);
    return user;
  }

  remove(id: string): Promise<number> {
    return this.userRepository.remove(id);
  }

  async exploreUsers(
    roleType: string,
    filters?: { category?: string },
  ): Promise<Record<string, unknown>[]> {
    const rawRole = roleType.toLowerCase();
    const isBrand = rawRole.startsWith('brand');
    const normalizedRole = isBrand ? 'brand' : 'creator';

    const role = await this.roleRepository.findByName(normalizedRole);
    if (!role) return [];

    const users = await this.userRepository.findUsersByRole(role.id, filters, isBrand);

    return users.map((user) => {
      const followersCount =
        (user.instagramFollowers || 0) +
        (user.tiktokFollowers || 0) +
        (user.youtubeFollowers || 0) +
        (user.twitterFollowers || 0);

      const baseInfo = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        city: user.city,
        followersCount,
      };

      if (isBrand) {
        return {
          ...baseInfo,
          industries: (user.industries || []).map((ind) => ({
            id: ind.id,
            name: ind.name,
          })),
          totalCampaigns: user.campaigns ? user.campaigns.length : 0,
        };
      } else {
        return {
          ...baseInfo,
          niches: (user.niches || []).map((niche) => ({
            id: niche.id,
            name: niche.name,
          })),
          assignedTier: user.assignedTier,
          avgRating: user.avgRating ? parseFloat(user.avgRating.toString()) : null,
          totalReviews: user.totalReviews || 0,
        };
      }
    });
  }

  async exploreProfile(id: string): Promise<Record<string, unknown>> {
    const user = await this.userRepository.findProfileById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleName = user.role?.name || (typeof user.role === 'string' ? user.role : 'creator');
    const isBrand = roleName.toLowerCase() === 'brand';

    const platforms: Record<string, { username: string; followers: number }> = {};
    if (user.instagramUsername) {
      platforms.instagram = {
        username: user.instagramUsername,
        followers: user.instagramFollowers || 0,
      };
    }
    if (user.tiktokUsername) {
      platforms.tiktok = {
        username: user.tiktokUsername,
        followers: user.tiktokFollowers || 0,
      };
    }
    if (user.youtubeUsername) {
      platforms.youtube = {
        username: user.youtubeUsername,
        followers: user.youtubeFollowers || 0,
      };
    }
    if (user.twitterUsername) {
      platforms.twitter = {
        username: user.twitterUsername,
        followers: user.twitterFollowers || 0,
      };
    }

    const formattedUser = user.toJSON();

    const response: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      city: user.city,
      state: formattedUser.state,
      country: formattedUser.country,
      role: roleName,
      platforms,
    };

    if (isBrand) {
      response['industries'] = (user.industries || []).map((ind) => ({
        id: ind.id,
        name: ind.name,
      }));
      response['campaigns'] = (user.campaigns || []).map((c) => ({
        id: c.id,
        title: c.title,
        goal: c.goal,
        totalBudget: c.totalBudget,
        coverImage: c.coverImage,
        status: c.status,
        timeline: c.timeline,
      }));
    } else {
      response['niches'] = (user.niches || []).map((n) => ({
        id: n.id,
        name: n.name,
      }));
      response['assignedTier'] = user.assignedTier;
      response['avgRating'] = user.avgRating ? parseFloat(user.avgRating.toString()) : null;
      response['totalReviews'] = user.totalReviews || 0;

      const reviews = await CampaignReview.findAll({
        where: { creatorId: id },
        include: [
          {
            model: User,
            as: 'brand',
            attributes: ['id', 'firstName', 'lastName', 'username', 'avatarUrl'],
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      response['reviews'] = reviews.map((r) => ({
        id: r.id,
        starRating: r.starRating,
        comment: r.comment,
        createdAt: r.createdAt,
        brand: r.brand
          ? {
              id: r.brand.id,
              firstName: r.brand.firstName,
              lastName: r.brand.lastName,
              username: r.brand.username,
              avatarUrl: r.brand.avatarUrl,
            }
          : null,
      }));
    }

    return response;
  }

  async unifiedSearch(query: ExploreSearchQueryDto): Promise<{
    campaigns: PaginatedResult<Campaign>;
    creators: PaginatedResult<any>;
    brands: PaginatedResult<any>;
  }> {
    const { q, page = 1, limit = 10 } = query;
    const searchPattern = `%${q}%`;

    // 1. Fetch roles
    const creatorRole = await this.roleRepository.findByName('creator');
    const brandRole = await this.roleRepository.findByName('brand');

    const creatorRoleId = creatorRole?.id;
    const brandRoleId = brandRole?.id;

    // 2. Perform concurrent lookups
    const [campaignsResult, creatorsResult, brandsResult] = await Promise.all([
      // Campaign search: status = 'live', title matches
      paginate(
        this.campaignModel,
        {
          where: {
            status: 'live',
            title: { [Op.iLike]: searchPattern },
          },
          order: [['createdAt', 'DESC']],
        },
        { page, limit },
      ),

      // Creator search: role = creator, active & verified, name/username matches
      creatorRoleId
        ? paginate(
            User,
            {
              where: {
                roleId: creatorRoleId,
                isActive: true,
                isEmailVerified: true,
                [Op.or]: [
                  { firstName: { [Op.iLike]: searchPattern } },
                  { lastName: { [Op.iLike]: searchPattern } },
                  { username: { [Op.iLike]: searchPattern } },
                ],
              },
              include: [{ model: Niche, as: 'niches', through: { attributes: [] } }],
              order: [['createdAt', 'DESC']],
              distinct: true,
              subQuery: false,
            },
            { page, limit },
          )
        : Promise.resolve({ data: [] as User[], pagination: { total: 0, page, limit, pages: 0 } }),

      // Brand search: role = brand, active & verified, name/username matches
      brandRoleId
        ? paginate(
            User,
            {
              where: {
                roleId: brandRoleId,
                isActive: true,
                isEmailVerified: true,
                [Op.or]: [
                  { firstName: { [Op.iLike]: searchPattern } },
                  { lastName: { [Op.iLike]: searchPattern } },
                  { username: { [Op.iLike]: searchPattern } },
                ],
              },
              include: [{ model: Industry, as: 'industries', through: { attributes: [] } }],
              order: [['createdAt', 'DESC']],
              distinct: true,
              subQuery: false,
            },
            { page, limit },
          )
        : Promise.resolve({ data: [] as User[], pagination: { total: 0, page, limit, pages: 0 } }),
    ]);

    // 3. Format creator results (calculate total followers count)
    const formattedCreators = creatorsResult.data.map((user: User) => {
      const followersCount =
        (user.instagramFollowers || 0) +
        (user.tiktokFollowers || 0) +
        (user.youtubeFollowers || 0) +
        (user.twitterFollowers || 0);

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        city: user.city,
        followersCount,
        niches: (user.niches || []).map((niche: Niche) => ({
          id: niche.id,
          name: niche.name,
        })),
        assignedTier: user.assignedTier,
        avgRating: user.avgRating ? parseFloat(user.avgRating.toString()) : null,
        totalReviews: user.totalReviews || 0,
      };
    });

    // 4. Format brand results
    const formattedBrands = brandsResult.data.map((user: User) => {
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        city: user.city,
        industries: (user.industries || []).map((ind: Industry) => ({
          id: ind.id,
          name: ind.name,
        })),
      };
    });

    return {
      campaigns: campaignsResult,
      creators: {
        data: formattedCreators,
        pagination: creatorsResult.pagination,
      },
      brands: {
        data: formattedBrands,
        pagination: brandsResult.pagination,
      },
    };
  }
}
