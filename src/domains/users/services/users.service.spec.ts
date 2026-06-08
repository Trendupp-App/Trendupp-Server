import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '../repository/user.repository';
import { User } from '../entities/user.entity';
import { RoleRepository } from '../repository/role.repository';
import { Role } from '../entities/role.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userRepositoryMock: jest.Mocked<UserRepository>;
  let roleRepositoryMock: jest.Mocked<RoleRepository>;

  beforeEach(async () => {
    userRepositoryMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    roleRepositoryMock = {
      findByName: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<RoleRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: userRepositoryMock },
        { provide: RoleRepository, useValue: roleRepositoryMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to userRepository.findAll', async () => {
      const mockUsers = [{ id: 'u1' }, { id: 'u2' }] as unknown as User[];
      userRepositoryMock.findAll.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should delegate to userRepository.findById with the given id', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com' } as unknown as User;
      userRepositoryMock.findById.mockResolvedValue(mockUser);

      const result = await service.findOne('u1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findById).toHaveBeenCalledWith('u1');
      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is found', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      const result = await service.findOne('missing-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should delegate to userRepository.findByEmail', async () => {
      const mockUser = { id: 'u1', email: 'test@example.com' } as unknown as User;
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when the user is not found', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should delegate to userRepository.create and return the new user', async () => {
      const data = { email: 'new@example.com', firstName: 'Test', lastName: 'User' };
      const mockUser = { id: 'u-new', ...data } as unknown as User;
      userRepositoryMock.create.mockResolvedValue(mockUser);

      const result = await service.create(data);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockUser);
    });
  });

  describe('remove', () => {
    it('should delegate to userRepository.remove and return the affected count', async () => {
      userRepositoryMock.remove.mockResolvedValue(1);

      const result = await service.remove('u1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(userRepositoryMock.remove).toHaveBeenCalledWith('u1');
      expect(result).toBe(1);
    });
  });

  describe('findRoleByName', () => {
    it('should delegate to roleRepository.findByName', async () => {
      const mockRole = { id: 'r1', name: 'creator' } as unknown as Role;
      roleRepositoryMock.findByName.mockResolvedValue(mockRole);

      const result = await service.findRoleByName('creator');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findByName).toHaveBeenCalledWith('creator');
      expect(result).toEqual(mockRole);
    });
  });

  describe('findRoleById', () => {
    it('should delegate to roleRepository.findById', async () => {
      const mockRole = { id: 'r1', name: 'creator' } as unknown as Role;
      roleRepositoryMock.findById.mockResolvedValue(mockRole);

      const result = await service.findRoleById('r1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findById).toHaveBeenCalledWith('r1');
      expect(result).toEqual(mockRole);
    });
  });

  describe('findAllRoles', () => {
    it('should delegate to roleRepository.findAll with default publicOnly=false', async () => {
      const mockRoles = [
        { id: 'r1', name: 'creator' },
        { id: 'r2', name: 'brand' },
      ] as unknown as Role[];
      roleRepositoryMock.findAll.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findAll).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockRoles);
    });

    it('should delegate to roleRepository.findAll with publicOnly=true', async () => {
      const mockRoles = [
        { id: 'r1', name: 'creator' },
        { id: 'r2', name: 'brand' },
      ] as unknown as Role[];
      roleRepositoryMock.findAll.mockResolvedValue(mockRoles);

      const result = await service.findAllRoles(true);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleRepositoryMock.findAll).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockRoles);
    });
  });
});
