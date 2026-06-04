import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.entity';
import { BaseService } from '../../core/base.service';

@Injectable()
export class UsersService extends BaseService<User> {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email } });
  }
}
