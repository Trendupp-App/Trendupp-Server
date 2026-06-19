import { Injectable, NotFoundException } from '@nestjs/common';
import { NicheRepository } from '../../users/repository/niche.repository';
import { NationalityRepository } from '../../users/repository/nationality.repository';
import { StateRepository } from '../../users/repository/state.repository';
import { BankRepository } from '../../users/repository/bank.repository';
import { IndustryRepository } from '../../users/repository/industry.repository';
import { UserRepository } from '../../users/repository/user.repository';
import { Niche } from '../../users/entities/niche.entity';
import { Nationality } from '../../users/entities/nationality.entity';
import { State } from '../../users/entities/state.entity';
import { Bank } from '../../users/entities/bank.entity';
import { Industry } from '../../users/entities/industry.entity';
import { User } from '../../users/entities/user.entity';
import { UpdateBrandRepresentativeDto } from '../../users/dtos/update-brand-representative.dto';
import { Op, WhereOptions } from 'sequelize';

let countryStateCityModule: typeof import('country-state-city') | null = null;
const getCountryStateCityModule = (): typeof import('country-state-city') => {
  if (countryStateCityModule) {
    return countryStateCityModule;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  countryStateCityModule = require('country-state-city') as typeof import('country-state-city');
  return countryStateCityModule;
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly nicheRepository: NicheRepository,
    private readonly nationalityRepository: NationalityRepository,
    private readonly stateRepository: StateRepository,
    private readonly bankRepository: BankRepository,
    private readonly industryRepository: IndustryRepository,
    private readonly userRepository: UserRepository,
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

  async getAllIndustries(): Promise<Industry[]> {
    return this.industryRepository.findAll();
  }

  async setUserIndustries(userId: string, industryIds: string[]): Promise<User | null> {
    await this.userRepository.setUserIndustries(userId, industryIds);
    return this.userRepository.findById(userId);
  }

  async setUserRepresentative(
    userId: string,
    dto: UpdateBrandRepresentativeDto,
  ): Promise<User | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await user.update({
      repFirstName: dto.repFirstName,
      repLastName: dto.repLastName,
      repEmail: dto.repEmail,
      repPhone: dto.repPhone,
    });
    return this.userRepository.findById(userId);
  }

  async getCitiesByCountryAndState(countryId: string, stateId: string): Promise<any[]> {
    const country = await this.nationalityRepository.findById(countryId);
    if (!country) {
      throw new NotFoundException('Country not found');
    }
    const state = await this.stateRepository.findById(stateId);
    if (!state || state.nationalityId !== countryId) {
      throw new NotFoundException('State not found or does not belong to the country');
    }

    const { State: CscState, City: CscCity } = getCountryStateCityModule();
    const cscStates = CscState.getStatesOfCountry(country.code);
    const cscState = cscStates.find((s) => s.name.toLowerCase() === state.name.toLowerCase());

    if (!cscState) {
      return [];
    }

    const cscCities = CscCity.getCitiesOfState(country.code, cscState.isoCode);
    return cscCities.map((c) => ({
      name: c.name,
    }));
  }
}
