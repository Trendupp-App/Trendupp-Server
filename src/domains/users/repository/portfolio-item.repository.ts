import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PortfolioItem } from '../entities/portfolio-item.entity';

@Injectable()
export class PortfolioItemRepository {
  constructor(
    @InjectModel(PortfolioItem)
    private readonly portfolioItemModel: typeof PortfolioItem,
  ) {}

  async create(data: {
    userId: string;
    title: string;
    link?: string;
    coverImage?: string;
  }): Promise<PortfolioItem> {
    return this.portfolioItemModel.create(data as PortfolioItem);
  }

  async findAllByUserId(userId: string): Promise<PortfolioItem[]> {
    return this.portfolioItemModel.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
  }

  async findById(id: string): Promise<PortfolioItem | null> {
    return this.portfolioItemModel.findByPk(id);
  }

  async delete(id: string, userId: string): Promise<number> {
    return this.portfolioItemModel.destroy({ where: { id, userId } });
  }
}
