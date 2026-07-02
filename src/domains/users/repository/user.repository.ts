import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes, WhereOptions, Op } from 'sequelize';
import { User } from '../entities/user.entity';
import { Industry } from '../entities/industry.entity';
import { Niche } from '../entities/niche.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({
      include: ['role', 'nationality', 'country', 'state', 'niches', 'industries', 'bank'],
    });
  }

  findById(id: string, includeNiches = true): Promise<User | null> {
    const includes = ['role', 'nationality', 'country', 'state', 'bank', 'industries'];
    if (includeNiches) {
      includes.push('niches');
    }
    return this.userModel.findByPk(id, { include: includes });
  }

  findProfileById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id, {
      include: [
        'role',
        'nationality',
        'country',
        'state',
        'bank',
        'industries',
        'niches',
        'campaigns',
      ],
    });
  }

  async findUsersByRole(
    roleId: string,
    filters?: { search?: string; category?: string },
    isBrand?: boolean,
  ): Promise<User[]> {
    const where: Record<string | symbol, unknown> = { roleId };

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: searchPattern } },
        { lastName: { [Op.iLike]: searchPattern } },
        { username: { [Op.iLike]: searchPattern } },
        { bio: { [Op.iLike]: searchPattern } },
      ];
    }

    if (filters?.category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        filters.category,
      );

      if (isBrand) {
        const matchedUsers = await this.userModel.findAll({
          attributes: ['id'],
          where: { roleId },
          include: [
            {
              model: Industry,
              as: 'industries',
              where: isUuid
                ? {
                    [Op.or]: [{ id: filters.category }, { name: { [Op.iLike]: filters.category } }],
                  }
                : { name: { [Op.iLike]: filters.category } },
              required: true,
            },
          ],
        });
        where['id'] = matchedUsers.map((u) => u.id);
      } else {
        const matchedUsers = await this.userModel.findAll({
          attributes: ['id'],
          where: { roleId },
          include: [
            {
              model: Niche,
              as: 'niches',
              where: isUuid
                ? {
                    [Op.or]: [{ id: filters.category }, { name: { [Op.iLike]: filters.category } }],
                  }
                : { name: { [Op.iLike]: filters.category } },
              required: true,
            },
          ],
        });
        where['id'] = matchedUsers.map((u) => u.id);
      }
    }

    return this.userModel.findAll({
      where: where as WhereOptions<User>,
      include: ['role', 'nationality', 'country', 'state', 'niches', 'industries', 'campaigns'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email }, include: ['role'] });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ where: { username }, include: ['role'] });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userModel.findOne({ where: { googleId }, include: ['role'] });
  }

  findByTiktokOpenId(tiktokOpenId: string): Promise<User | null> {
    return this.userModel.findOne({ where: { tiktokOpenId }, include: ['role'] });
  }

  findByInstagramOpenId(instagramOpenId: string): Promise<User | null> {
    return this.userModel.findOne({ where: { instagramOpenId }, include: ['role'] });
  }

  async setUserNiches(userId: string, nicheIds: string[]): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (user as any).$set('niches', nicheIds);
    }
  }

  async setUserIndustries(userId: string, industryIds: string[]): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (user as any).$set('industries', industryIds);
    }
  }

  create(data: Partial<Attributes<User>>): Promise<User> {
    // Sequelize's MakeNullishOptional conditional type cannot be satisfied
    // through a generic chain — casting to any at this boundary is idiomatic.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.userModel as any).create(data) as Promise<User>;
  }

  remove(id: string): Promise<number> {
    const where = { id } as unknown as WhereOptions<Attributes<User>>;
    return this.userModel.destroy({ where });
  }
}
