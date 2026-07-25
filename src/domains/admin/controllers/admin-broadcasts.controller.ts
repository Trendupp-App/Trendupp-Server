import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AdminBroadcastsService } from '../services/admin-broadcasts.service';
import {
  CreateBroadcastDto,
  UpdateBroadcastDto,
  QueryAdminBroadcastsDto,
} from '../dtos/admin-broadcasts.dto';

@ApiTags('admin-broadcasts')
@Controller('admin/broadcasts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminBroadcastsController {
  constructor(private readonly broadcastsService: AdminBroadcastsService) {}

  @Post()
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a broadcast notification (Draft, Send Now, or Schedule)' })
  @ApiResponse({ status: 201, description: 'Broadcast created successfully' })
  async createBroadcast(@CurrentUser() user: User, @Body() dto: CreateBroadcastDto) {
    const broadcast = await this.broadcastsService.createBroadcast(user.id, dto);
    return {
      message:
        dto.status === 'sent'
          ? 'Broadcast notification triggered for background delivery successfully.'
          : dto.status === 'scheduled'
            ? 'Broadcast notification scheduled successfully.'
            : 'Broadcast draft saved successfully.',
      broadcast,
    };
  }

  @Get()
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @ApiOperation({ summary: 'Get list of broadcast notifications with filters and pagination' })
  @ApiResponse({ status: 200, description: 'List of broadcasts retrieved' })
  async getBroadcasts(@Query() query: QueryAdminBroadcastsDto) {
    return this.broadcastsService.getBroadcastsList(query);
  }

  @Get(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @ApiOperation({ summary: 'Get details of a specific broadcast notification by ID' })
  @ApiResponse({ status: 200, description: 'Broadcast details retrieved' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  async getBroadcastById(@Param('id') id: string) {
    const broadcast = await this.broadcastsService.getBroadcastById(id);
    return { broadcast };
  }

  @Patch(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @ApiOperation({ summary: 'Update a draft or scheduled broadcast notification' })
  @ApiResponse({ status: 200, description: 'Broadcast updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot modify a broadcast that has already been sent' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  async updateBroadcast(@Param('id') id: string, @Body() dto: UpdateBroadcastDto) {
    const broadcast = await this.broadcastsService.updateBroadcast(id, dto);
    return {
      message: 'Broadcast updated successfully.',
      broadcast,
    };
  }

  @Delete(':id')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a draft or scheduled broadcast notification' })
  @ApiResponse({ status: 200, description: 'Broadcast deleted successfully' })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  async deleteBroadcast(@Param('id') id: string) {
    return this.broadcastsService.deleteBroadcast(id);
  }
}
