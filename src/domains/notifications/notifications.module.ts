import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bullmq';
import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { Broadcast } from './entities/broadcast.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { NotificationRepository } from './repository/notification.repository';
import { DeviceTokenRepository } from './repository/device-token.repository';
import { BroadcastRepository } from './repository/broadcast.repository';
import { NotificationsService } from './services/notifications.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationDispatchProcessor } from './services/notification-dispatch.processor';
import { NotificationsController } from './controllers/notifications.controller';
import { EmailModule } from '../../integration/email/email.module';
import { PushModule } from '../../integration/push/push.module';
import { UsersModule } from '../users/users.module';
import { NOTIFICATIONS_QUEUE } from './notifications.constants';

@Module({
  imports: [
    SequelizeModule.forFeature([Notification, DeviceToken, Broadcast, User, Role]),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    EmailModule,
    PushModule,
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationRepository,
    DeviceTokenRepository,
    BroadcastRepository,
    NotificationsService,
    NotificationDispatcherService,
    NotificationDispatchProcessor,
  ],
  exports: [NotificationsService, BroadcastRepository, SequelizeModule],
})
export class NotificationsModule {}
