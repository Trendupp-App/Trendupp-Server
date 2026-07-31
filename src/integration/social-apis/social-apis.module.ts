import { Module } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { TiktokAuthService } from './tiktok-auth.service';
import { InstagramAuthService } from './instagram-auth.service';
import { YoutubeAuthService } from './youtube-auth.service';
import { TwitterAuthService } from './twitter-auth.service';
import { FacebookAuthService } from './facebook-auth.service';
import { AppleAuthService } from './apple-auth.service';
import { InstagramInsightsService } from './insights/instagram-insights.service';
import { TiktokInsightsService } from './insights/tiktok-insights.service';
import { YoutubeInsightsService } from './insights/youtube-insights.service';
import { FacebookInsightsService } from './insights/facebook-insights.service';
import { TwitterInsightsService } from './insights/twitter-insights.service';
import { PostInsightsRegistry } from './insights/post-insights.registry';

@Module({
  providers: [
    GoogleAuthService,
    TiktokAuthService,
    InstagramAuthService,
    YoutubeAuthService,
    TwitterAuthService,
    FacebookAuthService,
    AppleAuthService,
    InstagramInsightsService,
    TiktokInsightsService,
    YoutubeInsightsService,
    FacebookInsightsService,
    TwitterInsightsService,
    PostInsightsRegistry,
  ],
  exports: [
    GoogleAuthService,
    TiktokAuthService,
    InstagramAuthService,
    YoutubeAuthService,
    TwitterAuthService,
    FacebookAuthService,
    AppleAuthService,
    PostInsightsRegistry,
  ],
})
export class SocialApisModule {}
