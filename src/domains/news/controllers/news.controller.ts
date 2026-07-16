import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from '../services/news.service';
import { FilterNewsDto } from '../dtos/filter-news.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('news')
@Controller('news')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all news articles (paginated and filtered)' })
  @ApiResponse({ status: 200, description: 'List of news articles retrieved successfully' })
  async getNews(@Query() filter: FilterNewsDto, @Request() req: { user?: { roles?: string[] } }) {
    const isAdmin =
      req.user?.roles?.includes('admin') || req.user?.roles?.includes('super_admin') || false;
    return this.newsService.findAll(filter, isAdmin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific news article by ID' })
  @ApiResponse({ status: 200, description: 'News article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'News article not found' })
  async getNewsById(@Param('id') id: string, @Request() req: { user?: { roles?: string[] } }) {
    const isAdmin =
      req.user?.roles?.includes('admin') || req.user?.roles?.includes('super_admin') || false;
    const news = await this.newsService.findById(id, isAdmin);
    return { news };
  }
}
