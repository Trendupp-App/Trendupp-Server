import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { PortfolioService } from '../services/portfolio.service';
import { CreatePortfolioItemDto } from '../dtos/create-portfolio-item.dto';

@ApiTags('portfolio')
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ─── Get all portfolio items for the authenticated user ────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all portfolio items for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Portfolio items retrieved successfully' })
  async getPortfolioItems(@CurrentUser() user: User) {
    const items = await this.portfolioService.getPortfolioItems(user.id);
    return { items };
  }

  // ─── Create a new portfolio item ───────────────────────────────────────────

  @Post()
  @UseInterceptors(FileInterceptor('coverImage'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Title of the portfolio item' },
        link: { type: 'string', description: 'URL or text link to the work (not validated)' },
        coverImage: {
          type: 'string',
          format: 'binary',
          description: 'Optional cover image (jpeg/jpg/png/webp, max 5MB)',
        },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new portfolio item (optional cover image ≤5MB)' })
  @ApiResponse({ status: 201, description: 'Portfolio item created successfully' })
  async createPortfolioItem(
    @CurrentUser() user: User,
    @Body() dto: CreatePortfolioItemDto,
    @UploadedFile() coverImage?: Express.Multer.File,
  ) {
    if (coverImage) {
      if (coverImage.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Cover image is too large. Max allowed size is 5MB.');
      }
      if (!/(jpeg|jpg|png|webp)$/i.test(coverImage.mimetype)) {
        throw new BadRequestException(
          'Invalid cover image file type. Allowed: jpeg, jpg, png, webp.',
        );
      }
    }

    const item = await this.portfolioService.createPortfolioItem(user.id, dto, coverImage);
    return {
      message: 'Portfolio item created successfully.',
      item,
    };
  }

  // ─── Delete a portfolio item ────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a portfolio item (owner only)' })
  @ApiResponse({ status: 200, description: 'Portfolio item deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — item does not belong to you' })
  @ApiResponse({ status: 404, description: 'Portfolio item not found' })
  async deletePortfolioItem(@Param('id') id: string, @CurrentUser() user: User) {
    await this.portfolioService.deletePortfolioItem(user.id, id);
    return { message: 'Portfolio item deleted successfully.' };
  }
}
