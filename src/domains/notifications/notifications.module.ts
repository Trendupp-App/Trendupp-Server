import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { NotificationRepository } from './repository/notification.repository';
import { DeviceTokenRepository } from './repository/device-token.repository';
import { NotificationsService } from './services/notifications.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationDispatchProcessor } from './services/notification-dispatch.processor';
import { NotificationsController } from './controllers/notifications.controller';
import { EmailModule } from '../../integration/email/email.module';
import { PushModule } from '../../integration/push/push.module';
import { UsersModule } from '../users/users.module';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

/**
 * Cross-cutting notification module (in-app + email, push-ready).
 *
 * To send a notification from any domain: add NotificationsModule to the
 * domain module's imports, inject NotificationsService, and call notify()
 * after the state change. See NOTIFICATION_SYSTEM_PLAN.md for the full
 * design and notification.catalog.ts for how to add a new type.
 *
 * User/Role models are injected directly (precedent:
 * account-lifecycle.scheduler.ts) so recipient loading never creates a
 * module cycle with domains that import this module.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([Notification, DeviceToken, User, Role]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    EmailModule,
    PushModule,
    // JwtAuthGuard on NotificationsController resolves UsersService from here.
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationRepository,
    DeviceTokenRepository,
    NotificationsService,
    NotificationDispatcherService,
    NotificationDispatchProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
