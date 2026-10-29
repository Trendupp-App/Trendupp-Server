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
import { Industry } from '../../users/entities/industry.entity';
import { User } from '../../users/entities/user.entity';
import { UpdateBrandRepresentativeDto } from '../../users/dtos/update-brand-representative.dto';
import { MarketingBudgetRepository } from '../../users/repository/marketing-budget.repository';
import { MarketingBudget } from '../../users/entities/marketing-budget.entity';
import {
  StartbuttonService,
  StartbuttonBank,
} from '../../../integration/payment-gateway/startbutton.service';

export interface OnboardingBank {
  id?: number | string;
  name: string;
  code: string;
  country?: string;
  region?: string;
  countryCode?: string;
  currency?: string;
  [key: string]: unknown;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly nicheRepository: NicheRepository,
    private readonly nationalityRepository: NationalityRepository,
    private readonly stateRepository: StateRepository,
    private readonly bankRepository: BankRepository,
    private readonly industryRepository: IndustryRepository,
    private readonly userRepository: UserRepository,
    private readonly marketingBudgetRepository: MarketingBudgetRepository,
    private readonly startbuttonService: StartbuttonService,
  ) {}

  async getAllNiches(): Promise<Niche[]> {
    return this.nicheRepository.findAll();
  }

  async getAllNationalities(filters?: { isAfrican?: boolean }): Promise<Nationality[]> {
    return this.nationalityRepository.findAll(filters);
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
    countryCode?: string;
    currency?: string;
    type?: string;
    search?: string;
  }): Promise<OnboardingBank[]> {
    let resolvedCountryCode = filters?.countryCode
      ? filters.countryCode.trim().toUpperCase()
      : undefined;
    let resolvedCountryName = filters?.country?.trim();
    let resolvedCurrency = filters?.currency ? filters.currency.trim().toUpperCase() : undefined;

    // Handle legacy country parameter (e.g. "Nigeria" or "NG")
    if (!resolvedCountryCode && resolvedCountryName) {
      if (resolvedCountryName.length === 2) {
        resolvedCountryCode = resolvedCountryName.toUpperCase();
        resolvedCountryName = undefined;
      } else {
        const nationalities = (await this.nationalityRepository.findAll()) || [];
        const matched = nationalities.find(
          (n) => n.name.toLowerCase() === resolvedCountryName!.toLowerCase(),
        );
        if (matched) {
          resolvedCountryCode = matched.code;
          resolvedCountryName = matched.name;
          if (!resolvedCurrency && matched.currency) {
            resolvedCurrency = matched.currency;
          }
        }
      }
    }

    // Resolve country name and currency from resolvedCountryCode if not already set
    if (resolvedCountryCode) {
      const nationalities = (await this.nationalityRepository.findAll()) || [];
      const matched = nationalities.find(
        (n) => n.code.toUpperCase() === resolvedCountryCode.toUpperCase(),
      );
      if (matched) {
        if (!resolvedCountryName) resolvedCountryName = matched.name;
        if (!resolvedCurrency && matched.currency) resolvedCurrency = matched.currency;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Country: CscCountry } = require('country-state-city') as {
          Country: typeof import('country-state-city').Country;
        };
        const cscCountry = CscCountry.getCountryByCode(resolvedCountryCode);
        if (cscCountry) {
          if (!resolvedCountryName) resolvedCountryName = cscCountry.name;
          if (!resolvedCurrency && cscCountry.currency) resolvedCurrency = cscCountry.currency;
        }
      }
    }

    // Determine default currency: map from countryCode or fallback to 'NGN'
    if (!resolvedCurrency) {
      if (resolvedCountryCode === 'NG') resolvedCurrency = 'NGN';
      else if (resolvedCountryCode === 'GH') resolvedCurrency = 'GHS';
      else if (resolvedCountryCode === 'KE') resolvedCurrency = 'KES';
      else if (resolvedCountryCode === 'ZA') resolvedCurrency = 'ZAR';
      else if (resolvedCountryCode === 'UG') resolvedCurrency = 'UGX';
      else if (resolvedCountryCode === 'RW') resolvedCurrency = 'RWF';
      else if (resolvedCountryCode === 'TZ') resolvedCurrency = 'TZS';
      else resolvedCurrency = 'NGN';
    }

    // Fetch banks directly from Startbutton API
    const banks = await this.startbuttonService.getBanks(resolvedCurrency, {
      countryCode: resolvedCountryCode,
      type: filters?.type,
    });

    let result: OnboardingBank[] = banks.map((bank: StartbuttonBank) => ({
      ...bank,
      // Retain country and region for backward compatibility with existing clients
      country: resolvedCountryName,
      region: filters?.region,
      countryCode: resolvedCountryCode,
      currency: resolvedCurrency,
    }));

    // Apply local search filter if requested
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (bank) =>
          bank.name?.toLowerCase().includes(searchLower) ||
          bank.code?.toLowerCase().includes(searchLower),
      );
    }

    return result;
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
    const updatePayload: Record<string, any> = {
      repFirstName: dto.repFirstName,
      repLastName: dto.repLastName,
      repEmail: dto.repEmail,
      repPhone: dto.repPhone,
    };
    if (dto.gender !== undefined) {
      updatePayload.gender = dto.gender;
    }
    await user.update(updatePayload);
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

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { State: CscState, City: CscCity } = require('country-state-city') as {
      State: typeof import('country-state-city').State;
      City: typeof import('country-state-city').City;
    };

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

  async getMarketingBudgets(filters?: { currency?: string }): Promise<MarketingBudget[]> {
    return this.marketingBudgetRepository.findAll(filters);
  }
}
