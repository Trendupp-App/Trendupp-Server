import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { AdminEscrowService } from '../services/admin-escrow.service';
import {
  QueryEscrowOverviewDto,
  QueryEscrowBalancesDto,
  QueryCreatorPayoutsDto,
  QueryAdvertiserRefundsDto,
} from '../dtos/admin-escrow.dto';

@ApiTags('admin-escrow')
@Controller('admin/escrow')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminEscrowController {
  constructor(private readonly escrowService: AdminEscrowService) {}

  @Get('overview')
  @Roles(
    'owner',
    'super_admin',
    'admin',
    'superadmin',
    'finance_admin',
    'moderator',
    'support_agent',
  )
  @ApiOperation({
    summary:
      'Get Escrow Overview data (Top summary cards, 4 monthly charts, and Recent Escrow Activity with financial breakdowns)',
  })
  @ApiResponse({ status: 200, description: 'Escrow overview retrieved' })
  async getOverview(@Query() query: QueryEscrowOverviewDto) {
    return this.escrowService.getOverview(query);
  }

  @Get('balances')
  @Roles(
    'owner',
    'super_admin',
    'admin',
    'superadmin',
    'finance_admin',
    'moderator',
    'support_agent',
  )
  @ApiOperation({
    summary: 'Get Escrow Balances tab data (Current Money in Escrow total + paginated list)',
  })
  @ApiResponse({ status: 200, description: 'Escrow balances retrieved' })
  async getBalances(@Query() query: QueryEscrowBalancesDto) {
    return this.escrowService.getEscrowBalances(query);
  }

  @Get('payouts/creators')
  @Roles(
    'owner',
    'super_admin',
    'admin',
    'superadmin',
    'finance_admin',
    'moderator',
    'support_agent',
  )
  @ApiOperation({
    summary: 'Get Creator Payouts tab data (4 status cards + paginated release list)',
  })
  @ApiResponse({ status: 200, description: 'Creator payouts retrieved' })
  async getCreatorPayouts(@Query() query: QueryCreatorPayoutsDto) {
    return this.escrowService.getCreatorPayouts(query);
  }

  @Get('refunds/advertisers')
  @Roles(
    'owner',
    'super_admin',
    'admin',
    'superadmin',
    'finance_admin',
    'moderator',
    'support_agent',
  )
  @ApiOperation({
    summary: 'Get Advertiser Refunds tab data (4 status cards + paginated refund list)',
  })
  @ApiResponse({ status: 200, description: 'Advertiser refunds retrieved' })
  async getAdvertiserRefunds(@Query() query: QueryAdvertiserRefundsDto) {
    return this.escrowService.getAdvertiserRefunds(query);
  }
}
