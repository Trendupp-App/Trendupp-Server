import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { S3Service } from '../../../integration/s3/s3.service';
import { PortfolioItemRepository } from '../repository/portfolio-item.repository';
import { PortfolioItem } from '../entities/portfolio-item.entity';
import { CreatePortfolioItemDto } from '../dtos/create-portfolio-item.dto';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly portfolioItemRepository: PortfolioItemRepository,
    private readonly s3Service: S3Service,
  ) {}

  async createPortfolioItem(
    userId: string,
    dto: CreatePortfolioItemDto,
    coverImageFile?: Express.Multer.File,
  ): Promise<PortfolioItem> {
    let coverImage: string | undefined;

    if (coverImageFile) {
      coverImage = await this.s3Service.uploadFile(coverImageFile);
    }

    return this.portfolioItemRepository.create({
      userId,
      title: dto.title,
      link: dto.link,
      coverImage,
    });
  }

  async getPortfolioItems(userId: string): Promise<PortfolioItem[]> {
    return this.portfolioItemRepository.findAllByUserId(userId);
  }

  async deletePortfolioItem(userId: string, itemId: string): Promise<void> {
    const item = await this.portfolioItemRepository.findById(itemId);

    if (!item) {
      throw new NotFoundException('Portfolio item not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this portfolio item.');
    }

    await this.portfolioItemRepository.delete(itemId, userId);
  }
}
