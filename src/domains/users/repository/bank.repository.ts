import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Bank } from '../entities/bank.entity';
import { WhereOptions } from 'sequelize';

@Injectable()
export class BankRepository {
  constructor(
    @InjectModel(Bank)
    private readonly bankModel: typeof Bank,
  ) {}

  async findAll(options?: { where?: WhereOptions<Bank> }): Promise<Bank[]> {
    return this.bankModel.findAll({
      where: options?.where,
      order: [['name', 'ASC']],
    });
  }

  async findById(id: string): Promise<Bank | null> {
    return this.bankModel.findByPk(id);
  }
}
