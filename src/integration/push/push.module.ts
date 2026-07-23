import { Module } from '@nestjs/common';
import { PushService } from './push.service';

/**
 * Shared FCM push module. Import this in any feature module that needs
 * PushService (currently only NotificationsModule).
 */
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
