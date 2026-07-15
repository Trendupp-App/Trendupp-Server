import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstagramTokenResponse {
  accessToken: string;
  userId: string;
}

export interface InstagramUserProfile {
  id: string;
  username: string;
}

export interface InstagramFollowerStats {
  id: string;
  username: string;
  followerCount: number;
}

@Injectable()
export class InstagramAuthService {
  private readonly logger = new Logger(InstagramAuthService.name);
  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('instagram.appId');
    this.appSecret = this.configService.get<string>('instagram.appSecret');

    this.isConfigured = Boolean(this.appId && this.appSecret);

    if (!this.isConfigured) {
      this.logger.warn(
        'Instagram credentials (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET) are missing. Instagram requests will fail until they are set.',
      );
    } else {
      this.logger.log('Instagram Auth Service initialized successfully.');
    }
  }

  /** No mock mode: every call requires real platform credentials. */
  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Instagram integration is not configured on this server (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)',
      );
    }
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<InstagramTokenResponse> {
    this.assertConfigured();

    try {
      const tokenUrl = 'https://api.instagram.com/oauth/access_token';
      const params = {
        client_id: this.appId!,
        client_secret: this.appSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };

      const body = new URLSearchParams(params);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Instagram token exchange failed: Status ${response.status} - ${errorText}`,
        );
        throw new UnauthorizedException('Failed to exchange authorization code with Instagram');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;
      const accessToken = responseBody.access_token as string;
      const rawUserId = responseBody.user_id;
      const userId =
        typeof rawUserId === 'string' || typeof rawUserId === 'number' ? String(rawUserId) : '';

      if (!accessToken || !userId) {
        this.logger.error(
          `Instagram token response missing fields: ${JSON.stringify(responseBody)}`,
        );
        throw new UnauthorizedException('Invalid token response from Instagram');
      }

      return { accessToken, userId };
    } catch (error) {
      this.logger.error(
        'Instagram exchangeCodeForToken error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to authenticate with Instagram');
    }
  }

  async getUserProfile(accessToken: string): Promise<InstagramUserProfile> {
    this.assertConfigured();

    try {
      const fields = 'id,username';
      const profileUrl = `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`;

      const response = await fetch(profileUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Instagram profile fetch failed: Status ${response.status} - ${errorText}`,
        );
        throw new UnauthorizedException('Failed to fetch Instagram user profile');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;
      const rawId = responseBody.id;
      const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
      const username = responseBody.username as string;

      if (!id || !username) {
        this.logger.error(
          `Instagram profile payload missing fields: ${JSON.stringify(responseBody)}`,
        );
        throw new UnauthorizedException('Invalid profile payload from Instagram');
      }

      return { id, username };
    } catch (error) {
      this.logger.error(
        'Instagram getUserProfile error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to retrieve Instagram user profile info');
    }
  }

  /**
   * Fetch follower count + handle to *verify* an Instagram connection.
   * `followers_count` is only returned for Professional (Business/Creator)
   * accounts on the Instagram Graph API; for personal accounts it is absent
   * and we default to 0.
   */
  async getFollowerStats(accessToken: string): Promise<InstagramFollowerStats> {
    this.assertConfigured();

    try {
      const fields = 'user_id,username,followers_count,account_type';
      const profileUrl = `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`;

      const response = await fetch(profileUrl, { method: 'GET' });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Instagram stats fetch failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch Instagram follower stats');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;
      const rawId = responseBody.user_id ?? responseBody.id;
      const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
      const username = responseBody.username as string;
      const followerCount = Number(responseBody.followers_count ?? 0);

      if (!id || !username) {
        this.logger.error(
          `Instagram stats payload missing fields: ${JSON.stringify(responseBody)}`,
        );
        throw new UnauthorizedException('Invalid stats payload from Instagram');
      }

      return { id, username, followerCount };
    } catch (error) {
      this.logger.error(
        'Instagram getFollowerStats error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to retrieve Instagram follower stats');
    }
  }
}
