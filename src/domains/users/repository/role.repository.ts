import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Role } from '../entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
  ) {}

  async findByName(name: string): Promise<Role | null> {
    return this.roleModel.findOne({ where: { name } });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleModel.findByPk(id);
  }

  async findAll(publicOnly = false): Promise<Role[]> {
    if (publicOnly) {
      return this.roleModel.findAll({
        where: {
          name: ['creator', 'brand'],
        },
      });
    }
    return this.roleModel.findAll();
  }
}
