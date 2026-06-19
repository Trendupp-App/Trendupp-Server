import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Industry } from '../entities/industry.entity';

@Injectable()
export class IndustryRepository {
  constructor(
    @InjectModel(Industry)
    private readonly industryModel: typeof Industry,
  ) {}

  async findAll(): Promise<Industry[]> {
    return this.industryModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  async findByIds(ids: string[]): Promise<Industry[]> {
    return this.industryModel.findAll({
      where: { id: ids },
    });
  }
}
