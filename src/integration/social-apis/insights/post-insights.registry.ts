import { Injectable } from '@nestjs/common';
import { SocialPlatform } from '../../../domains/socials/constants/social-platforms';
import { PostInsightsProvider } from './post-insights.types';
import { InstagramInsightsService } from './instagram-insights.service';
import { TiktokInsightsService } from './tiktok-insights.service';
import { YoutubeInsightsService } from './youtube-insights.service';
import { FacebookInsightsService } from './facebook-insights.service';
import { TwitterInsightsService } from './twitter-insights.service';

/**
 * Single lookup point so the domain layer never imports platform providers
 * directly — adding a platform means adding a provider here and a row in
 * PLATFORM_METRIC_SUPPORT, nothing else.
 */
@Injectable()
export class PostInsightsRegistry {
  private readonly providers: Map<SocialPlatform, PostInsightsProvider>;

  constructor(
    instagram: InstagramInsightsService,
    tiktok: TiktokInsightsService,
    youtube: YoutubeInsightsService,
    facebook: FacebookInsightsService,
    twitter: TwitterInsightsService,
  ) {
    this.providers = new Map<SocialPlatform, PostInsightsProvider>([
      [SocialPlatform.INSTAGRAM, instagram],
      [SocialPlatform.TIKTOK, tiktok],
      [SocialPlatform.YOUTUBE, youtube],
      [SocialPlatform.FACEBOOK, facebook],
      [SocialPlatform.TWITTER, twitter],
    ]);
  }

  get(platform: SocialPlatform): PostInsightsProvider | null {
    return this.providers.get(platform) ?? null;
  }
}
