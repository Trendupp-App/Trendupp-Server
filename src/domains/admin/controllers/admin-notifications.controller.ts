import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { NotificationRepository } from '../../notifications/repository/notification.repository';
import { ListNotificationsDto } from '../../notifications/dtos/list-notifications.dto';
import {
  NotificationItemDto,
  PaginatedNotificationsDto,
  UnreadCountDto,
  UpdatedCountDto,
} from '../../notifications/dtos/notification-response.dto';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';

/**
 * The ADMIN team's notification inbox (work items: disputes, escrow releases,
 * team changes, broadcast confirmations). Deliberately namespaced under
 * /admin/notifications and staff-role-guarded so it is never confused with
 * the consumer feed at /notifications (creators & brands).
 *
 * Reads the same notifications store — admin staff are rows in the users
 * table and receive rows via role fan-outs (recipientRole), which bypass all
 * user preference toggles (admins have no notification-settings UI).
 */
@ApiTags('admin-notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] List my staff notifications (paginated, newest first)',
    description:
      'The notification inbox for the authenticated STAFF member — dispute work items, ' +
      'escrow releases, team changes. Same filters as the consumer feed (unreadOnly, category).',
  })
  @ApiOkResponse({ description: 'Paginated notification feed', type: PaginatedNotificationsDto })
  list(@CurrentUser() user: User, @Query() query: ListNotificationsDto) {
    return this.notificationRepository.findForUser(user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      unreadOnly: query.unreadOnly,
      category: query.category,
    });
  }

  @Get('unread-count')
  @Throttle({ default: THROTTLE_LIMITS.NOTIFICATION_POLL })
  @ApiOperation({
    summary: '[Admin] Count my unread notifications (bell badge poll target)',
    description: 'Cheap endpoint intended for periodic polling (every 30–60s).',
  })
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notificationRepository.countUnread(user.id);
    return { count };
  }

  @Patch('seen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Admin] Mark all my notifications as seen (clears the badge, items stay unread)',
  })
  @ApiOkResponse({ type: UpdatedCountDto })
  async markAllSeen(@CurrentUser() user: User) {
    const updated = await this.notificationRepository.markAllSeen(user.id);
    return { updated };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Mark all my notifications as read' })
  @ApiOkResponse({ type: UpdatedCountDto })
  async markAllRead(@CurrentUser() user: User) {
    const updated = await this.notificationRepository.markAllRead(user.id);
    return { updated };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Mark one notification as read' })
  @ApiOkResponse({ description: 'The updated notification', type: NotificationItemDto })
  @ApiResponse({ status: 404, description: 'Notification not found (or not owned by caller)' })
  async markRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.notificationRepository.markRead(id, user.id);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }
}
