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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminUsersService } from '../services/admin-users.service';
import { AuditLogService } from '../services/audit-log.service';
import { AdminInviteDto } from '../dtos/admin-invite.dto';
import { UpdateAdminProfileDto } from '../dtos/update-admin-profile.dto';
import { QueryAdminUsersDto } from '../dtos/query-admin-users.dto';
import { QueryAuditLogsDto } from '../dtos/query-audit-logs.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('roles')
  @Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get available staff roles and descriptions' })
  async getRoles() {
    return this.adminUsersService.getRoles();
  }

  @Post('users/invite')
  @Roles('owner', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new sub-admin (Owner & SuperAdmin only)' })
  @ApiResponse({ status: 201, description: 'Sub-admin invitation sent successfully' })
  @ApiResponse({ status: 409, description: 'User email already exists' })
  async inviteAdmin(@CurrentUser() user: User, @Body() dto: AdminInviteDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminUsersService.inviteAdmin(user.id, dto, ipAddress, userAgent);
  }

  @Get('users')
  @Roles('owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all sub-admin accounts with search & filters (Owner & SuperAdmin only)',
  })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'sarah' })
  @ApiQuery({ name: 'role', required: false, type: String, example: 'finance_admin' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, example: true })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Sub-admins list retrieved' })
  async getAdmins(@Query() query: QueryAdminUsersDto) {
    return this.adminUsersService.findAllAdmins(query);
  }

  @Get('users/:id')
  @Roles('owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get details of a single sub-admin' })
  @ApiResponse({ status: 200, description: 'Sub-admin details retrieved' })
  @ApiResponse({ status: 404, description: 'Admin user not found' })
  async getAdminById(@Param('id') id: string) {
    const admin = await this.adminUsersService.findAdminById(id);
    return { admin };
  }

  @Patch('users/:id')
  @Roles('owner', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update sub-admin profile or role' })
  @ApiResponse({ status: 200, description: 'Sub-admin profile updated' })
  async updateAdmin(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAdminProfileDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    const admin = await this.adminUsersService.updateAdmin(user.id, id, dto, ipAddress, userAgent);
    return { message: 'Admin profile updated successfully.', admin };
  }

  @Patch('users/:id/suspend')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend/pause a sub-admin account (Owner ONLY)' })
  @ApiResponse({ status: 200, description: 'Sub-admin account suspended' })
  @ApiResponse({ status: 403, description: 'Forbidden — Owner role required' })
  async suspendAdmin(@CurrentUser() user: User, @Param('id') id: string, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminUsersService.suspendAdmin(user.id, id, ipAddress, userAgent);
  }

  @Patch('users/:id/reactivate')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended sub-admin account (Owner ONLY)' })
  @ApiResponse({ status: 200, description: 'Sub-admin account reactivated' })
  @ApiResponse({ status: 403, description: 'Forbidden — Owner role required' })
  async reactivateAdmin(@CurrentUser() user: User, @Param('id') id: string, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminUsersService.reactivateAdmin(user.id, id, ipAddress, userAgent);
  }

  @Delete('users/:id')
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a sub-admin account (Owner ONLY)' })
  @ApiResponse({ status: 200, description: 'Sub-admin account deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — Owner role required' })
  async deleteAdmin(@CurrentUser() user: User, @Param('id') id: string, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.adminUsersService.deleteAdmin(user.id, id, ipAddress, userAgent);
  }

  @Get('audit-logs')
  @Roles('owner', 'super_admin', 'finance_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] List the immutable action audit trail (paginated, newest first)',
    description:
      'Every privileged admin action (team changes, campaign mutations, settings edits, ...) ' +
      'with the acting admin, optional target user, IP, user agent and a details payload. ' +
      'Filter by action (exact) or q (substring), adminId, targetUserId, and a date range.',
  })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditLogService.findAll(query);
  }

  @Get('audit-logs/actions')
  @Roles('owner', 'super_admin', 'finance_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] List distinct audit-log action names (filter dropdown source)',
  })
  @ApiResponse({ status: 200, description: 'Distinct action names, alphabetical' })
  async getAuditLogActions() {
    const actions = await this.auditLogService.listActions();
    return { actions };
  }
}
