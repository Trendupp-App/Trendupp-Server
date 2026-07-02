import { Injectable, NotFoundException } from '@nestjs/common';
import { Attributes } from 'sequelize';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { RoleRepository } from '../repository/role.repository';
import { Role } from '../entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
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
    filters?: { search?: string; category?: string },
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
        };
      }
    });
  }

  async exploreProfile(id: string): Promise<Record<string, unknown>> {
    const user = await this.userRepository.findProfileById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
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
    }

    return response;
  }
}
