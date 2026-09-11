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

    const scheduledAtDate = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;

    const payload: Partial<News> = {
      ...dto,
      authorId,
      coverImage: coverImage,
      scheduledAt: scheduledAtDate,
    };

    // If status is scheduled but scheduledAt is past or now, publish immediately
    if (dto.status === 'scheduled' && scheduledAtDate && scheduledAtDate <= new Date()) {
      payload.status = 'published';
      payload.publishedAt = new Date();
    } else if (dto.status === 'published') {
      payload.publishedAt = new Date();
    }

    const created = await this.newsRepository.create(payload);
    return this.findById(created.id, true);
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

    // Prevent non-admins from viewing draft or scheduled news
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

    const scheduledAtDate = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;

    const payload: Partial<News> = {
      ...dto,
      coverImage: coverImage,
      scheduledAt: scheduledAtDate,
    };

    // Handle scheduled status transition
    if (dto.status === 'scheduled' && scheduledAtDate && scheduledAtDate <= new Date()) {
      payload.status = 'published';
      payload.publishedAt = new Date();
    } else if (dto.status === 'published' && existing.status !== 'published') {
      payload.publishedAt = new Date();
    } else if (dto.status === 'draft') {
      payload.publishedAt = null as unknown as Date; // Allow null to clear
    }

    const [affectedCount] = await this.newsRepository.update(id, payload);

    if (affectedCount === 0) {
      throw new NotFoundException('News article not found');
    }

    return this.findById(id, true);
  }

  async publishDueScheduledNews(): Promise<number> {
    const dueNewsList = await this.newsRepository.findDueScheduled(new Date());
    let count = 0;
    for (const news of dueNewsList) {
      await this.newsRepository.update(news.id, {
        status: 'published',
        publishedAt: new Date(),
      });
      count++;
    }
    return count;
  }

  async delete(id: string) {
    const affectedCount = await this.newsRepository.delete(id);

    if (affectedCount === 0) {
      throw new NotFoundException('News article not found');
    }

    return { success: true };
  }
}
