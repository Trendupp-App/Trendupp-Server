import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Niche } from '../entities/niche.entity';

@Injectable()
export class NicheRepository {
  constructor(
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
  ) {}

  async findAll(): Promise<Niche[]> {
    return this.nicheModel.findAll({
      order: [['order', 'ASC']],
    });
  }

  async findByIds(ids: string[]): Promise<Niche[]> {
    return this.nicheModel.findAll({
      where: { id: ids },
    });
  }
}
