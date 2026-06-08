import { Injectable, NotFoundException } from '@nestjs/common';
import { NicheRepository } from '../repository/niche.repository';
import { NationalityRepository } from '../repository/nationality.repository';
import { StateRepository } from '../repository/state.repository';
import { Niche } from '../entities/niche.entity';
import { Nationality } from '../entities/nationality.entity';
import { State } from '../entities/state.entity';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly nicheRepository: NicheRepository,
    private readonly nationalityRepository: NationalityRepository,
    private readonly stateRepository: StateRepository,
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
}
