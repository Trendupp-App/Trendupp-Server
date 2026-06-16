import { Injectable, NotFoundException } from '@nestjs/common';
import { NicheRepository } from '../../users/repository/niche.repository';
import { NationalityRepository } from '../../users/repository/nationality.repository';
import { StateRepository } from '../../users/repository/state.repository';
import { BankRepository } from '../../users/repository/bank.repository';
import { Niche } from '../../users/entities/niche.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { State } from '../../users/entities/state.entity';
import { Bank } from '../../users/entities/bank.entity';
import { Op, WhereOptions } from 'sequelize';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly nicheRepository: NicheRepository,
    private readonly nationalityRepository: NationalityRepository,
    private readonly stateRepository: StateRepository,
    private readonly bankRepository: BankRepository,
  ) {}

  async getAllNiches(): Promise<Niche[]> {
    return this.nicheRepository.findAll();
  }

  async getAllNationalities(): Promise<Nationality[]> {
    return this.nationalityRepository.findAll();
  }

  async getStatesByNationality(nationalityId: string): Promise<State[]> {
    const nationality = await this.nationalityRepository.findById(nationalityId);
    if (!nationality) {
      throw new NotFoundException('Nationality not found');
    }
    return this.stateRepository.findByNationalityId(nationalityId);
  }

  async getBanks(filters?: {
    region?: string;
    country?: string;
    search?: string;
  }): Promise<Bank[]> {
    const where: Record<string, unknown> = {};

    if (filters?.region) {
      where['region'] = { [Op.iLike]: `%${filters.region}%` };
    }

    if (filters?.country) {
      where['country'] = { [Op.iLike]: `%${filters.country}%` };
    }

    if (filters?.search) {
      where['name'] = { [Op.iLike]: `%${filters.search}%` };
    }

    return this.bankRepository.findAll({ where: where as WhereOptions<Bank> });
  }
}
