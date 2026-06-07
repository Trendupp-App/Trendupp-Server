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
    return this.userModel.findAll();
  }

  findById(id: string): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
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
