import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Attributes, WhereOptions } from 'sequelize';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  findAll(): Promise<User[]> {
    return this.userModel.findAll({
      include: ['role', 'nationality', 'country', 'state', 'niches'],
    });
  }

  findById(id: string, includeNiches = true): Promise<User | null> {
    const includes = ['role', 'nationality', 'country', 'state'];
    if (includeNiches) {
      includes.push('niches');
    }
    return this.userModel.findByPk(id, { include: includes });
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
