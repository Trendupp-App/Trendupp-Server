import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { UserRepository } from './user.repository';
import { User } from '../entities/user.entity';

describe('UserRepository', () => {
  let repository: UserRepository;
  let modelMock: jest.Mocked<typeof User>;

  beforeEach(async () => {
    modelMock = {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<typeof User>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: getModelToken(User), useValue: modelMock }],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findAll', () => {
    it('should call userModel.findAll and return all users', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ] as unknown as User[];
      modelMock.findAll.mockResolvedValue(mockUsers);

      const result = await repository.findAll();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findById', () => {
    it('should call userModel.findByPk with the given id', async () => {
      const mockUser = { id: 'user-1', email: 'a@example.com' } as unknown as User;
      modelMock.findByPk.mockResolvedValue(mockUser);

      const result = await repository.findById('user-1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.findByPk).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is found', async () => {
      modelMock.findByPk.mockResolvedValue(null);

      const result = await repository.findById('missing-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should call userModel.findOne with the given email', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' } as unknown as User;
      modelMock.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is found', async () => {
      modelMock.findOne.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should call userModel.create with the provided data and return the new user', async () => {
      const data = { email: 'new@example.com', firstName: 'Test', lastName: 'User' };
      const mockUser = { id: 'user-new', ...data } as unknown as User;
      modelMock.create.mockResolvedValue(mockUser);

      const result = await repository.create(data);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockUser);
    });
  });

  describe('remove', () => {
    it('should call userModel.destroy with the given id and return the affected count', async () => {
      modelMock.destroy = jest.fn().mockResolvedValue(1 as any);

      const result = await repository.remove('user-1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.destroy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(result).toBe(1);
    });
  });
});
