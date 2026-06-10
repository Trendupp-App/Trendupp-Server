import { Module } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { TiktokAuthService } from './tiktok-auth.service';

@Module({
  providers: [GoogleAuthService, TiktokAuthService],
  exports: [GoogleAuthService, TiktokAuthService],
})
export class SocialApisModule {}
