import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { IssueCategory } from '../entities/issue-category.entity';

@Injectable()
export class IssueCategoryRepository {
  constructor(
    @InjectModel(IssueCategory)
    private readonly categoryModel: typeof IssueCategory,
  ) {}

  async findAll(): Promise<IssueCategory[]> {
    return this.categoryModel.findAll({ order: [['name', 'ASC']] });
  }

  async findById(id: string): Promise<IssueCategory | null> {
    return this.categoryModel.findByPk(id);
  }
}
