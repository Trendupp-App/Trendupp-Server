import { BadRequestException, Injectable } from '@nestjs/common';
import { TiktokAuthService } from '../../../integration/social-apis/tiktok-auth.service';
import { InstagramAuthService } from '../../../integration/social-apis/instagram-auth.service';
import { YoutubeAuthService } from '../../../integration/social-apis/youtube-auth.service';
import { TwitterAuthService } from '../../../integration/social-apis/twitter-auth.service';
import { SocialPlatform } from '../constants/social-platforms';

export interface ConnectInput {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface VerifiedSocial {
  platformUserId?: string;
  username: string;
  avatarUrl?: string;
  followerCount: number;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}

export interface RefreshedStats {
  username?: string;
  avatarUrl?: string;
  followerCount: number;
}

/**
 * Dispatches the per-platform OAuth + follower-stats calls and normalises each
 * provider's response into a single shape the SocialsService can persist.
 */
@Injectable()
export class SocialVerificationService {
  constructor(
    private readonly tiktok: TiktokAuthService,
    private readonly instagram: InstagramAuthService,
    private readonly youtube: YoutubeAuthService,
    private readonly twitter: TwitterAuthService,
  ) {}

  async verify(platform: SocialPlatform, input: ConnectInput): Promise<VerifiedSocial> {
    switch (platform) {
      case SocialPlatform.TIKTOK:
        return this.verifyTiktok(input);
      case SocialPlatform.INSTAGRAM:
        return this.verifyInstagram(input);
      case SocialPlatform.YOUTUBE:
        return this.verifyYoutube(input);
      case SocialPlatform.TWITTER:
        return this.verifyTwitter(input);
      default:
        throw new BadRequestException(`Unsupported platform: ${String(platform)}`);
    }
  }

  /** Re-pull stats for an already-connected account using its stored token. */
  async refreshStats(platform: SocialPlatform, accessToken: string): Promise<RefreshedStats> {
    switch (platform) {
      case SocialPlatform.TIKTOK: {
        const s = await this.tiktok.getFollowerStats(accessToken);
        return { username: s.username, avatarUrl: s.avatarUrl, followerCount: s.followerCount };
      }
      case SocialPlatform.INSTAGRAM: {
        const s = await this.instagram.getFollowerStats(accessToken);
        return { username: s.username, followerCount: s.followerCount };
      }
      case SocialPlatform.YOUTUBE: {
        const s = await this.youtube.getChannelStats(accessToken);
        return { username: s.username, avatarUrl: s.avatarUrl, followerCount: s.followerCount };
      }
      case SocialPlatform.TWITTER: {
        const s = await this.twitter.getUserStats(accessToken);
        return { username: s.username, avatarUrl: s.avatarUrl, followerCount: s.followerCount };
      }
      default:
        throw new BadRequestException(`Unsupported platform: ${String(platform)}`);
    }
  }

  private static expiry(expiresIn?: number): Date | null {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  private async verifyTiktok(input: ConnectInput): Promise<VerifiedSocial> {
    const token = await this.tiktok.exchangeCodeForToken(
      input.code,
      input.redirectUri,
      input.codeVerifier,
    );
    const stats = await this.tiktok.getFollowerStats(token.accessToken);
    return {
      platformUserId: stats.openId,
      username: stats.username,
      avatarUrl: stats.avatarUrl,
      followerCount: stats.followerCount,
      accessToken: token.accessToken,
    };
  }

  private async verifyInstagram(input: ConnectInput): Promise<VerifiedSocial> {
    const token = await this.instagram.exchangeCodeForToken(input.code, input.redirectUri);
    const stats = await this.instagram.getFollowerStats(token.accessToken);
    return {
      platformUserId: stats.id,
      username: stats.username,
      followerCount: stats.followerCount,
      accessToken: token.accessToken,
    };
  }

  private async verifyYoutube(input: ConnectInput): Promise<VerifiedSocial> {
    const token = await this.youtube.exchangeCodeForToken(
      input.code,
      input.redirectUri,
      input.codeVerifier,
    );
    const stats = await this.youtube.getChannelStats(token.accessToken);
    return {
      platformUserId: stats.channelId,
      username: stats.username,
      avatarUrl: stats.avatarUrl,
      followerCount: stats.followerCount,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? null,
      tokenExpiresAt: SocialVerificationService.expiry(token.expiresIn),
    };
  }

  private async verifyTwitter(input: ConnectInput): Promise<VerifiedSocial> {
    const token = await this.twitter.exchangeCodeForToken(
      input.code,
      input.redirectUri,
      input.codeVerifier,
    );
    const stats = await this.twitter.getUserStats(token.accessToken);
    return {
      platformUserId: stats.userId,
      username: stats.username,
      avatarUrl: stats.avatarUrl,
      followerCount: stats.followerCount,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? null,
      tokenExpiresAt: SocialVerificationService.expiry(token.expiresIn),
    };
  }
}
