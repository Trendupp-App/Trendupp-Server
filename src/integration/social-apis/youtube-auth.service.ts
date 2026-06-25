import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface YoutubeTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface YoutubeChannelStats {
  channelId: string;
  username: string;
  followerCount: number;
  avatarUrl?: string;
}

/**
 * YouTube "connect" adapter.
 *
 * Uses Google OAuth (with the `youtube.readonly` scope) to exchange an auth
 * code, then reads subscriber count from the YouTube Data API v3. Distinct
 * from the Google *login* service (which only verifies an ID token).
 */
@Injectable()
export class YoutubeAuthService {
  private readonly logger = new Logger(YoutubeAuthService.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('youtube.clientId');
    this.clientSecret = this.configService.get<string>('youtube.clientSecret');
    this.isMockMode = !this.clientId || !this.clientSecret;

    if (this.isMockMode) {
      this.logger.warn(
        'YouTube credentials (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET) are missing. YouTube connect will run in MOCK mode.',
      );
    } else {
      this.logger.log('YouTube Auth Service initialized successfully.');
    }
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<YoutubeTokenResponse> {
    if (this.isMockMode || code.startsWith('mock_') || code.startsWith('{')) {
      this.logger.warn(`MOCK mode: Simulating YouTube token exchange for code: ${code}`);
      return { accessToken: 'mock-youtube-access-token-123456789', expiresIn: 3600 };
    }

    try {
      const params: Record<string, string> = {
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };
      if (codeVerifier) params.code_verifier = codeVerifier;

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `YouTube token exchange failed: Status ${response.status} - ${errorText}`,
        );
        throw new UnauthorizedException('Failed to exchange authorization code with YouTube');
      }

      const data = (await response.json()) as Record<string, unknown>;
      const accessToken = data.access_token as string;
      if (!accessToken) {
        this.logger.error(`YouTube token response missing access_token: ${JSON.stringify(data)}`);
        throw new UnauthorizedException('Invalid token response from YouTube');
      }

      return {
        accessToken,
        refreshToken: data.refresh_token as string | undefined,
        expiresIn: data.expires_in as number | undefined,
      };
    } catch (error) {
      this.logger.error(
        'YouTube exchangeCodeForToken error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to authenticate with YouTube');
    }
  }

  async getChannelStats(accessToken: string): Promise<YoutubeChannelStats> {
    if (this.isMockMode || accessToken.startsWith('mock-youtube-access-token-')) {
      this.logger.warn('MOCK mode: Simulating YouTube channel stats fetch.');
      return {
        channelId: 'mock-youtube-channel-id-123456789',
        username: 'Mock YouTube Channel',
        followerCount: 2300,
        avatarUrl: 'https://placehold.co/150x150.png',
      };
    }

    try {
      const url =
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true';
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`YouTube stats fetch failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch YouTube channel stats');
      }

      const body = (await response.json()) as Record<string, unknown>;
      const items = (body.items as Array<Record<string, unknown>> | undefined) || [];
      if (items.length === 0) {
        throw new UnauthorizedException('No YouTube channel found for this account');
      }

      const channel = items[0];
      const channelId = channel.id as string;
      const snippet = (channel.snippet || {}) as Record<string, unknown>;
      const statistics = (channel.statistics || {}) as Record<string, unknown>;
      const thumbnails = (snippet.thumbnails || {}) as Record<string, Record<string, unknown>>;

      const username =
        (snippet.customUrl as string | undefined) ||
        (snippet.title as string | undefined) ||
        'YouTube Channel';
      const followerCount = Number(statistics.subscriberCount ?? 0);
      const avatarUrl = thumbnails.default?.url as string | undefined;

      return { channelId, username, followerCount, avatarUrl };
    } catch (error) {
      this.logger.error(
        'YouTube getChannelStats error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to retrieve YouTube channel stats');
    }
  }
}
