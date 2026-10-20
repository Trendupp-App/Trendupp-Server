/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { NicheRepository } from '../../users/repository/niche.repository';
import { NationalityRepository } from '../../users/repository/nationality.repository';
import { StateRepository } from '../../users/repository/state.repository';
import { BankRepository } from '../../users/repository/bank.repository';
import { IndustryRepository } from '../../users/repository/industry.repository';
import { UserRepository } from '../../users/repository/user.repository';
import { Nationality } from '../../users/entities/nationality.entity';
import { State } from '../../users/entities/state.entity';
import { User } from '../../users/entities/user.entity';
import { Industry } from '../../users/entities/industry.entity';
import { MarketingBudgetRepository } from '../../users/repository/marketing-budget.repository';
import { MarketingBudget } from '../../users/entities/marketing-budget.entity';

import { StartbuttonService } from '../../../integration/payment-gateway/startbutton.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let nicheRepositoryMock: jest.Mocked<NicheRepository>;
  let nationalityRepositoryMock: jest.Mocked<NationalityRepository>;
  let stateRepositoryMock: jest.Mocked<StateRepository>;
  let bankRepositoryMock: jest.Mocked<BankRepository>;
  let industryRepositoryMock: jest.Mocked<IndustryRepository>;
  let userRepositoryMock: jest.Mocked<UserRepository>;
  let marketingBudgetRepositoryMock: jest.Mocked<MarketingBudgetRepository>;
  let startbuttonServiceMock: jest.Mocked<StartbuttonService>;

  beforeEach(async () => {
    nicheRepositoryMock = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<NicheRepository>;

    nationalityRepositoryMock = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
    } as unknown as jest.Mocked<NationalityRepository>;

    stateRepositoryMock = {
      findByNationalityId: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<StateRepository>;

    bankRepositoryMock = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<BankRepository>;

    industryRepositoryMock = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IndustryRepository>;

    userRepositoryMock = {
      setUserIndustries: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    marketingBudgetRepositoryMock = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<MarketingBudgetRepository>;

    startbuttonServiceMock = {
      getBanks: jest.fn(),
    } as unknown as jest.Mocked<StartbuttonService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: NicheRepository, useValue: nicheRepositoryMock },
        { provide: NationalityRepository, useValue: nationalityRepositoryMock },
        { provide: StateRepository, useValue: stateRepositoryMock },
        { provide: BankRepository, useValue: bankRepositoryMock },
        { provide: IndustryRepository, useValue: industryRepositoryMock },
        { provide: UserRepository, useValue: userRepositoryMock },
        { provide: MarketingBudgetRepository, useValue: marketingBudgetRepositoryMock },
        { provide: StartbuttonService, useValue: startbuttonServiceMock },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllIndustries', () => {
    it('should return all industries sorted by name', async () => {
      const mockIndustries = [{ id: '1', name: 'Tech' }] as unknown as Industry[];
      industryRepositoryMock.findAll.mockResolvedValue(mockIndustries);

      const result = await service.getAllIndustries();
      expect(result).toEqual(mockIndustries);
      expect(industryRepositoryMock.findAll).toHaveBeenCalled();
    });
  });

  describe('setUserIndustries', () => {
    it('should call userRepository.setUserIndustries and return the updated user', async () => {
      const mockUser = { id: 'user-1', email: 'brand@test.com' } as unknown as User;
      userRepositoryMock.setUserIndustries.mockResolvedValue(undefined);
      userRepositoryMock.findById.mockResolvedValue(mockUser);

      const result = await service.setUserIndustries('user-1', ['ind-1']);
      expect(result).toEqual(mockUser);
      expect(userRepositoryMock.setUserIndustries).toHaveBeenCalledWith('user-1', ['ind-1']);
      expect(userRepositoryMock.findById).toHaveBeenCalledWith('user-1');
    });
  });

  describe('setUserRepresentative', () => {
    it('should throw NotFoundException if user is not found', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.setUserRepresentative('missing-id', {
          repFirstName: 'John',
          repLastName: 'Doe',
          repEmail: 'john@test.com',
          repPhone: '123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return user if found', async () => {
      const mockUserUpdate = jest.fn();
      const mockUser = {
        id: 'user-1',
        update: mockUserUpdate,
      } as unknown as User;

      userRepositoryMock.findById.mockResolvedValueOnce(mockUser);
      userRepositoryMock.findById.mockResolvedValueOnce(mockUser);

      const result = await service.setUserRepresentative('user-1', {
        repFirstName: 'John',
        repLastName: 'Doe',
        repEmail: 'john@test.com',
        repPhone: '123',
      });

      expect(result).toEqual(mockUser);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        repFirstName: 'John',
        repLastName: 'Doe',
        repEmail: 'john@test.com',
        repPhone: '123',
      });
    });
  });

  describe('getCitiesByCountryAndState', () => {
    it('should throw NotFoundException if country not found', async () => {
      nationalityRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.getCitiesByCountryAndState('missing-c', 'state-s')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if state not found', async () => {
      const mockCountry = { id: 'c-1', code: 'NG' } as Nationality;
      nationalityRepositoryMock.findById.mockResolvedValue(mockCountry);
      stateRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.getCitiesByCountryAndState('c-1', 'state-s')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if state does not belong to country', async () => {
      const mockCountry = { id: 'c- NG', code: 'NG' } as Nationality;
      const mockState = { id: 's-1', name: 'Lagos', nationalityId: 'c-different' } as State;
      nationalityRepositoryMock.findById.mockResolvedValue(mockCountry);
      stateRepositoryMock.findById.mockResolvedValue(mockState);

      await expect(service.getCitiesByCountryAndState('c- NG', 's-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty list if state code not found in country-state-city library', async () => {
      const mockCountry = { id: 'c-1', code: 'NG' } as Nationality;
      const mockState = { id: 's-1', name: 'NonexistentState', nationalityId: 'c-1' } as State;
      nationalityRepositoryMock.findById.mockResolvedValue(mockCountry);
      stateRepositoryMock.findById.mockResolvedValue(mockState);

      const result = await service.getCitiesByCountryAndState('c-1', 's-1');
      expect(result).toEqual([]);
    });

    it('should map and return cities when state and country are successfully matched', async () => {
      const mockCountry = { id: 'c-1', code: 'NG' } as Nationality;
      const mockState = { id: 's-1', name: 'Lagos', nationalityId: 'c-1' } as State;
      nationalityRepositoryMock.findById.mockResolvedValue(mockCountry);
      stateRepositoryMock.findById.mockResolvedValue(mockState);

      const result = await service.getCitiesByCountryAndState('c-1', 's-1');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(expect.objectContaining({ name: 'Ikeja' }));
    });
  });

  describe('getMarketingBudgets', () => {
    it('should call marketingBudgetRepository.findAll with filters', async () => {
      const mockBudgets = [
        { id: '1', value: '$100 - $1000', currency: 'USD' },
      ] as unknown as MarketingBudget[];
      marketingBudgetRepositoryMock.findAll.mockResolvedValue(mockBudgets);

      const result = await service.getMarketingBudgets({ currency: 'USD' });
      expect(result).toEqual(mockBudgets);
      expect(marketingBudgetRepositoryMock.findAll).toHaveBeenCalledWith({ currency: 'USD' });
    });
  });

  describe('getBanks', () => {
    it('should fetch banks from StartbuttonService with resolved currency and countryCode', async () => {
      const mockBanks = [
        { id: 1, name: 'Access Bank', code: '044' },
        { id: 2, name: 'Zenith Bank', code: '057' },
      ];
      startbuttonServiceMock.getBanks.mockResolvedValue(mockBanks);

      const result = await service.getBanks({ countryCode: 'NG', currency: 'NGN' });

      expect(startbuttonServiceMock.getBanks).toHaveBeenCalledWith('NGN', {
        countryCode: 'NG',
        type: undefined,
      });
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Access Bank');
      expect(result[0].countryCode).toBe('NG');
    });

    it('should resolve country name and currency when countryCode GH is provided', async () => {
      const mockBanks = [
        { id: 76, name: 'Absa Bank Ghana Ltd', code: '030100' },
      ];
      startbuttonServiceMock.getBanks.mockResolvedValue(mockBanks);
      nationalityRepositoryMock.findAll.mockResolvedValue([
        { id: 'nat-gh', name: 'Ghana', code: 'GH', currency: 'GHS' },
      ] as any);

      const result = await service.getBanks({ countryCode: 'GH' });

      expect(startbuttonServiceMock.getBanks).toHaveBeenCalledWith('GHS', {
        countryCode: 'GH',
        type: undefined,
      });
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Absa Bank Ghana Ltd');
      expect(result[0].country).toBe('Ghana');
      expect(result[0].countryCode).toBe('GH');
      expect(result[0].currency).toBe('GHS');
    });

    it('should filter banks locally by search term', async () => {
      const mockBanks = [
        { id: 1, name: 'Access Bank', code: '044' },
        { id: 2, name: 'Zenith Bank', code: '057' },
      ];
      startbuttonServiceMock.getBanks.mockResolvedValue(mockBanks);

      const result = await service.getBanks({ search: 'zenith' });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Zenith Bank');
    });
  });
});
