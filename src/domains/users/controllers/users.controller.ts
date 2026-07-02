import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExploreSearchQueryDto } from '../dtos/explore-search-query.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user(upcoming!!!🔥🔥)' })
  @ApiResponse({ status: 201, type: User })
  create(@Body() createUserDto: Record<string, unknown>) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users from table' })
  @ApiResponse({ status: 200, type: [User] })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('explore/search')
  @ApiOperation({
    summary:
      '📌Unified search for campaigns (by title) and users (creators/brands by name/username)',
  })
  @ApiResponse({ status: 200, description: 'Grouped explore search results' })
  async exploreSearch(@Query() query: ExploreSearchQueryDto) {
    return this.usersService.unifiedSearch(query);
  }

  @Get('explore/profile/:id')
  @ApiOperation({
    summary:
      '📌Get single creator or brand profile details with campaign history and platform followers',
  })
  @ApiResponse({ status: 200, description: 'Profile details for creator or brand' })
  async getExploreProfile(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.usersService.exploreProfile(id);
  }

  @Get('explore/:role')
  @ApiOperation({ summary: '📌Explore creators or brands with optional category filter' })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Industry name/ID or Niche name/ID',
  })
  @ApiResponse({ status: 200, description: 'List of creators or brands matching criteria' })
  async explore(
    @Param('role') role: string,
    @Query('category') category?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.usersService.exploreUsers(role, { category });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: User })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
