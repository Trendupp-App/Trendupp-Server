import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { News } from '../entities/news.entity';
import { FilterNewsDto } from '../dtos/filter-news.dto';
import { User } from '../../users/entities/user.entity';
import { Industry } from '../../users/entities/industry.entity';

@Injectable()
export class NewsRepository {
  constructor(
    @InjectModel(News)
    private readonly newsModel: typeof News,
  ) {}

  async create(data: Partial<News>): Promise<News> {
    return this.newsModel.create(data as News);
  }

  async findById(id: string): Promise<News | null> {
    return this.newsModel.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
        },
        { model: Industry, as: 'industry', attributes: ['id', 'name'] },
      ],
    });
  }

  async findAll(
    filter: FilterNewsDto,
    isAdmin: boolean = false,
  ): Promise<{ rows: News[]; count: number }> {
    const where: WhereOptions<News> = {};

    if (filter.search) {
      Object.assign(where, {
        [Op.or]: [
          { title: { [Op.iLike]: `%${filter.search}%` } },
          { summary: { [Op.iLike]: `%${filter.search}%` } },
        ],
      });
    }

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.industryId) {
      where.industryId = filter.industryId;
    }

    if (filter.isPlatformUpdate !== undefined) {
      where.isPlatformUpdate = filter.isPlatformUpdate;
    }

    if (filter.isTopNews !== undefined) {
      where.isTopNews = filter.isTopNews;
    }

    // Admins can filter by status, others can only see published news
    if (isAdmin && filter.status) {
      where.status = filter.status;
    } else if (!isAdmin) {
      where.status = 'published';
    }

    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const offset = (page - 1) * limit;

    return this.newsModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['publishedAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
        },
        { model: Industry, as: 'industry', attributes: ['id', 'name'] },
      ],
    });
  }

  async update(id: string, data: Partial<News>): Promise<[number, News[]]> {
    return this.newsModel.update(data, {
      where: { id },
      returning: true,
    });
  }

  async delete(id: string): Promise<number> {
    return this.newsModel.destroy({
      where: { id },
    });
  }
}
