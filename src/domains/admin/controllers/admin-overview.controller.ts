import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminOverviewService } from '../services/admin-overview.service';
import { AdminOverviewResponseDto } from '../dtos/admin-overview.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@ApiTags('admin-overview')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminOverviewController {
  constructor(private readonly adminOverviewService: AdminOverviewService) {}

  @Get('overview')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full Admin Overview Dashboard statistics and key metrics',
    description:
      'Returns unified top KPI metrics, pending actions required, campaign status breakdown, creator tiers distribution, recent campaign activity, and top performing creators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin overview data retrieved successfully',
    type: AdminOverviewResponseDto,
  })
  async getOverview(): Promise<AdminOverviewResponseDto> {
    return this.adminOverviewService.getOverview();
  }
}
