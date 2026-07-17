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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { NotificationRepository } from '../repository/notification.repository';
import { ListNotificationsDto } from '../dtos/list-notifications.dto';
import {
  NotificationItemDto,
  PaginatedNotificationsDto,
  UnreadCountDto,
  UpdatedCountDto,
} from '../dtos/notification-response.dto';
import { THROTTLE_LIMITS } from '../../../shared/constants/throttle.constants';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  @Get()
  @ApiOperation({
    summary: 'List my notifications (paginated, newest first)',
    description:
      'The in-app notification feed for the authenticated user. Each item carries a ' +
      'pre-rendered title/body, a deep-link actionUrl, the raw event payload in data, and ' +
      'the actor who triggered it. Filter with unreadOnly and category. See ' +
      'docs/NOTIFICATIONS.md for the full catalog of notification types.',
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
    summary: 'Count my unread notifications (badge poll target)',
    description:
      'Cheap endpoint intended for periodic polling (every 30–60s) to drive the bell badge.',
  })
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notificationRepository.countUnread(user.id);
    return { count };
  }

  @Patch('seen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all my notifications as seen (clears the badge, items stay unread)',
    description:
      'Call when the notification tray is opened: zeroes the badge without marking ' +
      'individual items as read.',
  })
  @ApiOkResponse({ type: UpdatedCountDto })
  async markAllSeen(@CurrentUser() user: User) {
    const updated = await this.notificationRepository.markAllSeen(user.id);
    return { updated };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiOkResponse({ type: UpdatedCountDto })
  async markAllRead(@CurrentUser() user: User) {
    const updated = await this.notificationRepository.markAllRead(user.id);
    return { updated };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read' })
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
