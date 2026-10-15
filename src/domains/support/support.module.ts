import { Module } from '@nestjs/common';
import { SupportController } from './controllers/support.controller';
import { UsersModule } from '../users/users.module';

/**
 * Zoho Desk ASAP bridge. The support experience itself lives in Zoho Desk
 * (embedded via the ASAP add-on in the web and mobile apps); this module only
 * mints the short-lived user JWT the ASAP widget/SDK uses to authenticate the
 * signed-in Trendupp user. See docs/ZOHO_DESK_SUPPORT_PLAN.md.
 */
@Module({
  imports: [
    // JwtAuthGuard on SupportController resolves UsersService from here.
    UsersModule,
  ],
  controllers: [SupportController],
})
export class SupportModule {}
