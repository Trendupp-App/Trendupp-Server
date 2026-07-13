import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Shared email module. Import this in any feature module that needs EmailService.
 * Auth module registers EmailService directly and can continue to do so,
 * but other modules (e.g. UsersModule) should import EmailModule instead.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
