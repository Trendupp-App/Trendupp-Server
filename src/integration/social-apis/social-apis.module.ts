import { Module } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { TiktokAuthService } from './tiktok-auth.service';
import { InstagramAuthService } from './instagram-auth.service';
import { YoutubeAuthService } from './youtube-auth.service';
import { TwitterAuthService } from './twitter-auth.service';
import { FacebookAuthService } from './facebook-auth.service';
import { AppleAuthService } from './apple-auth.service';

@Module({
  providers: [
    GoogleAuthService,
    TiktokAuthService,
    InstagramAuthService,
    YoutubeAuthService,
    TwitterAuthService,
    FacebookAuthService,
    AppleAuthService,
  ],
  exports: [
    GoogleAuthService,
    TiktokAuthService,
    InstagramAuthService,
    YoutubeAuthService,
    TwitterAuthService,
    FacebookAuthService,
    AppleAuthService,
  ],
})
export class SocialApisModule {}
