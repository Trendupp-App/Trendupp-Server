import { Module } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { TiktokAuthService } from './tiktok-auth.service';
import { InstagramAuthService } from './instagram-auth.service';

@Module({
  providers: [GoogleAuthService, TiktokAuthService, InstagramAuthService],
  exports: [GoogleAuthService, TiktokAuthService, InstagramAuthService],
})
export class SocialApisModule {}
