import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NewsService } from '../services/news.service';
import { FilterNewsDto } from '../dtos/filter-news.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('news')
@Controller('news')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  private checkIsAdmin(user?: User): boolean {
    const roleRaw: unknown = user?.role;
    const userRole =
      typeof roleRaw === 'object' && roleRaw !== null && 'name' in roleRaw
        ? (roleRaw as { name: string }).name
        : ((roleRaw as string | undefined) ?? '');

    return ['admin', 'superadmin', 'super_admin'].includes(userRole.toLowerCase());
  }

  @Get()
  @ApiOperation({ summary: 'Get all news articles (paginated and filtered)' })
  @ApiResponse({ status: 200, description: 'List of news articles retrieved successfully' })
  async getNews(@Query() filter: FilterNewsDto, @CurrentUser() user: User) {
    const isAdmin = this.checkIsAdmin(user);
    return this.newsService.findAll(filter, isAdmin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific news article by ID' })
  @ApiResponse({ status: 200, description: 'News article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'News article not found' })
  async getNewsById(@Param('id') id: string, @CurrentUser() user: User) {
    const isAdmin = this.checkIsAdmin(user);
    const news = await this.newsService.findById(id, isAdmin);
    return { news };
  }
}
