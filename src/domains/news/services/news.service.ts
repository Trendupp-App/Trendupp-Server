import { Injectable, NotFoundException } from '@nestjs/common';
import { NewsRepository } from '../repository/news.repository';
import { CreateNewsDto } from '../dtos/create-news.dto';
import { UpdateNewsDto } from '../dtos/update-news.dto';
import { FilterNewsDto } from '../dtos/filter-news.dto';
import { News } from '../entities/news.entity';
import { S3Service } from '../../../integration/s3/s3.service';

@Injectable()
export class NewsService {
  constructor(
    private readonly newsRepository: NewsRepository,
    private readonly s3Service: S3Service,
  ) {}

  async create(authorId: string, dto: CreateNewsDto, coverImageFile?: Express.Multer.File) {
    let coverImage: string | undefined = dto.coverImage as string | undefined;

    if (coverImageFile) {
      coverImage = await this.s3Service.uploadFile(coverImageFile, 'news-covers');
    }

    const payload: Partial<News> = {
      ...dto,
      authorId,
      coverImage: coverImage,
    };

    // Automatically set publishedAt if status is published
    if (dto.status === 'published') {
      payload.publishedAt = new Date();
    }

    return this.newsRepository.create(payload);
  }

  async findAll(filter: FilterNewsDto, isAdmin: boolean = false) {
    const result = await this.newsRepository.findAll(filter, isAdmin);

    return {
      data: result.rows,
      meta: {
        total: result.count,
        page: filter.page || 1,
        limit: filter.limit || 10,
        totalPages: Math.ceil(result.count / (filter.limit || 10)),
      },
    };
  }

  async findById(id: string, isAdmin: boolean = false) {
    const news = await this.newsRepository.findById(id);

    if (!news) {
      throw new NotFoundException('News article not found');
    }

    // Prevent non-admins from viewing draft news
    if (!isAdmin && news.status !== 'published') {
      throw new NotFoundException('News article not found');
    }

    return news;
  }

  async update(id: string, dto: UpdateNewsDto, coverImageFile?: Express.Multer.File) {
    const existing = await this.findById(id, true);

    let coverImage: string | undefined = dto.coverImage as string | undefined;

    if (coverImageFile) {
      coverImage = await this.s3Service.uploadFile(coverImageFile, 'news-covers');
    }

    const payload: Partial<News> = {
      ...dto,
      coverImage: coverImage,
    };

    // Handle transition to published status
    if (dto.status === 'published' && existing.status !== 'published') {
      payload.publishedAt = new Date();
    } else if (dto.status === 'draft') {
      payload.publishedAt = null as unknown as Date; // Allow null to clear
    }

    const [affectedCount, updatedRows] = await this.newsRepository.update(id, payload);

    if (affectedCount === 0) {
      throw new NotFoundException('News article not found');
    }

    return updatedRows[0];
  }

  async delete(id: string) {
    const affectedCount = await this.newsRepository.delete(id);

    if (affectedCount === 0) {
      throw new NotFoundException('News article not found');
    }

    return { success: true };
  }
}
