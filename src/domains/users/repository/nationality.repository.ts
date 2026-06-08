import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Nationality } from '../entities/nationality.entity';

@Injectable()
export class NationalityRepository {
  constructor(
    @InjectModel(Nationality)
    private readonly nationalityModel: typeof Nationality,
  ) {}

  async findAll(): Promise<Nationality[]> {
    return this.nationalityModel.findAll({
      order: [['name', 'ASC']],
    });
  }

  async findById(id: string): Promise<Nationality | null> {
    return this.nationalityModel.findByPk(id);
  }
}
