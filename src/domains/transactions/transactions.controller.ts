import { Controller, Get, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { THROTTLE_LIMITS } from '../../shared/constants/throttle.constants';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Creator: Full payout dashboard.
   *
   * Returns:
   *  - summary  { availableBalance, thirtyDayHold, totalEarned, totalFailed, currency }
   *  - transactions  { total, page, limit, pages, items[] }
   *  - escrow  { totalFundsYetToBeReleased, items[] }
   */
  @Get('payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary: 'Get creator payout dashboard — transactions history & pending escrow (creator only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description:
      'Creator payout dashboard: summary wallet card, transaction history, and escrow pending items',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — creator role required' })
  async getCreatorPayouts(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.transactionsService.getCreatorPayouts(user.id, pageNum, limitNum);
  }

  /**
   * Brand: Full payment management dashboard.
   *
   * Returns:
   *  - summary  { escrowBalance, thirtyDayHold, totalPayout, currency }
   *  - transactions  { total, page, limit, pages, items[] }
   *  - escrow  { totalActiveEscrow, items[] }
   */
  @Get('manage-payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('brand')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: THROTTLE_LIMITS.LOOKUP })
  @ApiOperation({
    summary:
      'Get brand payment management dashboard — escrow positions, ledger & summary (brand only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description:
      'Brand payment management dashboard: summary card, merged transaction ledger, and active escrow positions',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — brand role required' })
  async getBrandPayments(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.transactionsService.getBrandPayments(user.id, pageNum, limitNum);
  }
}
