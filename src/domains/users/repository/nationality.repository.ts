import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Nationality } from '../entities/nationality.entity';

@Injectable()
export class NationalityRepository {
  constructor(
    @InjectModel(Nationality)
    private readonly nationalityModel: typeof Nationality,
  ) {}

  async findAll(filters?: { isAfrican?: boolean }): Promise<Nationality[]> {
    const where: Record<string, any> = {};
    if (filters?.isAfrican !== undefined) {
      where.isAfrican = filters.isAfrican;
    }
    return this.nationalityModel.findAll({
      where,
      order: [['name', 'ASC']],
    });
  }

  async findById(id: string): Promise<Nationality | null> {
    return this.nationalityModel.findByPk(id);
  }
}
