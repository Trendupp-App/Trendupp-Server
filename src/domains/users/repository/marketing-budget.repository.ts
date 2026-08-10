import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { MarketingBudget } from '../entities/marketing-budget.entity';

@Injectable()
export class MarketingBudgetRepository {
  constructor(
    @InjectModel(MarketingBudget)
    private readonly marketingBudgetModel: typeof MarketingBudget,
  ) {}

  async findAll(filters?: { currency?: string }): Promise<MarketingBudget[]> {
    const where: Record<string, any> = {};
    if (filters?.currency) {
      where.currency = filters.currency.toUpperCase();
    }
    return this.marketingBudgetModel.findAll({
      where,
      order: [
        ['currency', 'ASC'],
        ['minValue', 'ASC'],
      ],
    });
  }
}
