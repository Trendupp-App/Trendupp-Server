/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsRepository } from '../repository/news.repository';
import { S3Service } from '../../../integration/s3/s3.service';

describe('NewsService', () => {
  let service: NewsService;
  let newsRepoMock: jest.Mocked<NewsRepository>;
  let s3ServiceMock: jest.Mocked<S3Service>;

  beforeEach(async () => {
    newsRepoMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<NewsRepository>;

    s3ServiceMock = {
      uploadFile: jest.fn(),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: NewsRepository, useValue: newsRepoMock },
        { provide: S3Service, useValue: s3ServiceMock },
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a news article and set publishedAt if status is published', async () => {
      const dto = { title: 'Test', content: 'Content', category: 'Update', status: 'published' };
      const expectedDate = expect.any(Date);
      newsRepoMock.create.mockResolvedValue({ id: 'n1', ...dto, publishedAt: new Date() } as any);

      const result = await service.create('u1', dto);

      expect(newsRepoMock.create).toHaveBeenCalledWith({
        ...dto,
        authorId: 'u1',
        publishedAt: expectedDate,
      });
      expect(result).toBeDefined();
    });

    it('should create a news article as draft without setting publishedAt', async () => {
      const dto = { title: 'Test', content: 'Content', category: 'Update', status: 'draft' };
      newsRepoMock.create.mockResolvedValue({ id: 'n1', ...dto } as any);

      const result = await service.create('u1', dto);

      expect(newsRepoMock.create).toHaveBeenCalledWith({
        ...dto,
        authorId: 'u1',
      });
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if not found', async () => {
      newsRepoMock.findById.mockResolvedValue(null);
      await expect(service.findById('n1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if draft and not admin', async () => {
      newsRepoMock.findById.mockResolvedValue({ id: 'n1', status: 'draft' } as any);
      await expect(service.findById('n1', false)).rejects.toThrow(NotFoundException);
    });

    it('should return draft if admin', async () => {
      newsRepoMock.findById.mockResolvedValue({ id: 'n1', status: 'draft' } as any);
      const result = await service.findById('n1', true);
      expect(result.id).toBe('n1');
    });

    it('should return published news for non-admin', async () => {
      newsRepoMock.findById.mockResolvedValue({ id: 'n1', status: 'published' } as any);
      const result = await service.findById('n1', false);
      expect(result.id).toBe('n1');
    });
  });

  describe('update', () => {
    it('should update and set publishedAt when changing to published', async () => {
      newsRepoMock.findById.mockResolvedValue({ id: 'n1', status: 'draft' } as any);
      newsRepoMock.update.mockResolvedValue([1, [{ id: 'n1', status: 'published' } as any]]);

      const result = await service.update('n1', { status: 'published' });

      expect(newsRepoMock.update).toHaveBeenCalledWith(
        'n1',
        expect.objectContaining({
          status: 'published',
          publishedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe('published');
    });

    it('should throw NotFoundException if update affects 0 rows', async () => {
      newsRepoMock.findById.mockResolvedValue({ id: 'n1', status: 'published' } as any);
      newsRepoMock.update.mockResolvedValue([0, []]);

      await expect(service.update('n1', { title: 'New' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a news article', async () => {
      newsRepoMock.delete.mockResolvedValue(1);
      const result = await service.delete('n1');
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if delete affects 0 rows', async () => {
      newsRepoMock.delete.mockResolvedValue(0);
      await expect(service.delete('n1')).rejects.toThrow(NotFoundException);
    });
  });
});
