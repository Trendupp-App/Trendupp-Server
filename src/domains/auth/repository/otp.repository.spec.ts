import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { OtpRepository } from './otp.repository';
import { Otp } from '../entities/otp.entity';

describe('OtpRepository', () => {
  let repository: OtpRepository;
  let modelMock: jest.Mocked<typeof Otp>;

  beforeEach(async () => {
    modelMock = {
      create: jest.fn(),
      findOne: jest.fn(),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<typeof Otp>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpRepository, { provide: getModelToken(Otp), useValue: modelMock }],
    }).compile();

    repository = module.get<OtpRepository>(OtpRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('deleteByEmailAndType', () => {
    it('should call destroy with email, type, and force: true', async () => {
      modelMock.destroy = jest.fn().mockResolvedValue(1 as any);

      await repository.deleteByEmailAndType('test@example.com', 'login');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.destroy).toHaveBeenCalledWith({
        where: { email: 'test@example.com', type: 'login' },
        force: true,
      });
    });
  });

  describe('create', () => {
    it('should call otpModel.create with the provided data', async () => {
      const otpData = {
        email: 'test@example.com',
        code: '123456',
        type: 'login',
        otpExpiresAt: new Date(),
      };
      modelMock.create.mockResolvedValue({ ...otpData, id: 'uuid-1' } as any);

      const result = await repository.create(otpData);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.create).toHaveBeenCalledWith(otpData);
      expect(result).toMatchObject({ email: 'test@example.com', code: '123456' });
    });
  });

  describe('findByEmailAndCode', () => {
    it('should call findOne with email, code, and order by createdAt DESC', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      modelMock.findOne.mockResolvedValue({
        id: 'otp-id',
        code: '123456',
        otpExpiresAt: futureDate,
      } as any);

      const result = await repository.findByEmailAndCode('test@example.com', '123456');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', code: '123456' },
        order: [['createdAt', 'DESC']],
      });
      expect(result?.id).toBe('otp-id');
    });

    it('should return null when no record is found', async () => {
      modelMock.findOne.mockResolvedValue(null);

      const result = await repository.findByEmailAndCode('test@example.com', '000000');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('should call destroy with the given id and force: true', async () => {
      modelMock.destroy = jest.fn().mockResolvedValue(1 as any);

      await repository.deleteById('otp-id');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(modelMock.destroy).toHaveBeenCalledWith({
        where: { id: 'otp-id' },
        force: true,
      });
    });
  });
});
