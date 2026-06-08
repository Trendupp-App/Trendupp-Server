import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { State } from '../entities/state.entity';

@Injectable()
export class StateRepository {
  constructor(
    @InjectModel(State)
    private readonly stateModel: typeof State,
  ) {}

  async findByNationalityId(nationalityId: string): Promise<State[]> {
    return this.stateModel.findAll({
      where: { nationalityId },
      order: [['name', 'ASC']],
    });
  }

  async findById(id: string): Promise<State | null> {
    return this.stateModel.findByPk(id);
  }
}
