import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { DisputesService } from '../services/disputes.service';
import { CreateDisputeDto } from '../dtos/create-dispute.dto';
import { ActivateDisputeDto } from '../dtos/activate-dispute.dto';
import { ResolveDisputeDto } from '../dtos/resolve-dispute.dto';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get('stream-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Stream Chat user authentication token' })
  @ApiResponse({ status: 200, description: 'User token returned successfully' })
  getStreamToken(@CurrentUser() user: User) {
    return this.disputesService.getStreamToken({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Raise a dispute for a campaign (Creators & Brands)' })
  @ApiResponse({ status: 201, description: 'Dispute raised successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or duplicate dispute' })
  async raiseDispute(@CurrentUser() user: User, @Body() dto: CreateDisputeDto) {
    const roleName = user.role?.name || '';
    return this.disputesService.raiseDispute(user.id, roleName, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all disputes associated with the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of disputes retrieved' })
  async listDisputes(@CurrentUser() user: User) {
    const roleName = user.role?.name || '';
    return this.disputesService.listDisputes(user.id, roleName);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get details of a single dispute' })
  @ApiResponse({ status: 200, description: 'Dispute details retrieved' })
  @ApiResponse({ status: 403, description: 'Access forbidden' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async getDispute(@CurrentUser() user: User, @Param('id') id: string) {
    const roleName = user.role?.name || '';
    return this.disputesService.getDispute(id, user.id, roleName);
  }

  @Post(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a raised dispute & initialize GetStream chat (Admins only)' })
  @ApiResponse({ status: 200, description: 'Dispute activated and chat channel created' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async activateDispute(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ActivateDisputeDto,
  ) {
    return this.disputesService.activateDispute(id, user.id, dto);
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'finance_admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resolve a campaign dispute and lock the chat (Admin, Finance Admin & Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Dispute resolved and chat channel frozen' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin, finance_admin or super_admin role required',
  })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async resolveDispute(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    // Standard role gate is handled by guard, but verify role just in case
    const roleName = user.role?.name || '';
    const canResolve = ['admin', 'finance_admin', 'super_admin'].includes(roleName);
    if (!canResolve) {
      throw new ForbiddenException('Only Admin, Finance Admin or Super Admin can resolve disputes');
    }
    return this.disputesService.resolveDispute(id, user.id, dto);
  }
}
