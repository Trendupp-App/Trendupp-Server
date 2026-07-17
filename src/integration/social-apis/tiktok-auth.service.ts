import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TiktokTokenResponse {
  accessToken: string;
  openId: string;
}

export interface TiktokUserProfile {
  openId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface TiktokFollowerStats {
  openId: string;
  username: string;
  displayName: string;
  followerCount: number;
  avatarUrl?: string;
}

@Injectable()
export class TiktokAuthService {
  private readonly logger = new Logger(TiktokAuthService.name);
  private readonly clientKey: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.clientKey = this.configService.get<string>('tiktok.clientKey');
    this.clientSecret = this.configService.get<string>('tiktok.clientSecret');

    this.isConfigured = Boolean(this.clientKey && this.clientSecret);

    if (!this.isConfigured) {
      this.logger.warn(
        'TikTok credentials (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET) are missing. TikTok requests will fail until they are set.',
      );
    } else {
      this.logger.log('TikTok Auth Service initialized successfully.');
    }
  }

  /** No mock mode: every call requires real platform credentials. */
  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'TikTok integration is not configured on this server (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET)',
      );
    }
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<TiktokTokenResponse> {
    this.assertConfigured();

    try {
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
      const params: Record<string, string> = {
        client_key: this.clientKey!,
        client_secret: this.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      };

      if (codeVerifier) {
        params.code_verifier = codeVerifier;
      }

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
        this.logger.error(`TikTok token exchange failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to exchange authorization code with TikTok');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;
      const data = (responseBody.data || responseBody) as Record<string, unknown>;

      const accessToken = data.access_token as string;
      const openId = data.open_id as string;

      if (!accessToken || !openId) {
        this.logger.error(`TikTok token response missing fields: ${JSON.stringify(responseBody)}`);
        throw new UnauthorizedException('Invalid token response from TikTok');
      }

      return { accessToken, openId };
    } catch (error) {
      this.logger.error(
        'TikTok exchangeCodeForToken error',
        error instanceof Error ? error.stack : error,
      );
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException('Failed to authenticate with TikTok');
    }
  }

  async getUserProfile(accessToken: string): Promise<TiktokUserProfile> {
    this.assertConfigured();

    try {
      const fields = 'open_id,union_id,avatar_url,display_name';
      const profileUrl = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;

      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`TikTok profile fetch failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch TikTok user profile');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;

      const errorObj = responseBody.error as Record<string, unknown> | undefined;
      if (errorObj && errorObj.code !== 'ok' && errorObj.code !== 0) {
        this.logger.error(`TikTok API returned error: ${JSON.stringify(responseBody.error)}`);
        throw new UnauthorizedException(`TikTok API error: ${String(errorObj.message)}`);
      }

      const data = (responseBody.data || {}) as Record<string, unknown>;
      const user = (data.user || {}) as Record<string, unknown>;

      const openId = user.open_id as string;
      const displayName = (user.display_name || 'TikTok User') as string;
      const avatarUrl = user.avatar_url as string | undefined;

      if (!openId) {
        this.logger.error(
          `TikTok profile payload missing open_id: ${JSON.stringify(responseBody)}`,
        );
        throw new UnauthorizedException('Invalid profile payload from TikTok');
      }

      return { openId, displayName, avatarUrl };
    } catch (error) {
      this.logger.error(
        'TikTok getUserProfile error',
        error instanceof Error ? error.stack : error,
      );
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException('Failed to retrieve TikTok user profile info');
    }
  }

  /**
   * Fetch the follower count + handle used to *verify* a TikTok connection.
   * Requires the `user.info.stats` (and `user.info.profile`) scopes on the
   * access token.
   */
  async getFollowerStats(accessToken: string): Promise<TiktokFollowerStats> {
    this.assertConfigured();

    try {
      const fields = 'open_id,union_id,avatar_url,display_name,username,follower_count';
      const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`TikTok stats fetch failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch TikTok follower stats');
      }

      const responseBody = (await response.json()) as Record<string, unknown>;
      const errorObj = responseBody.error as Record<string, unknown> | undefined;
      if (errorObj && errorObj.code !== 'ok' && errorObj.code !== 0) {
        this.logger.error(`TikTok API returned error: ${JSON.stringify(responseBody.error)}`);
        throw new UnauthorizedException(`TikTok API error: ${String(errorObj.message)}`);
      }

      const data = (responseBody.data || {}) as Record<string, unknown>;
      const user = (data.user || {}) as Record<string, unknown>;

      const openId = user.open_id as string;
      const displayName = (user.display_name || 'TikTok User') as string;
      const username = (user.username as string | undefined) || displayName;
      const followerCount = Number(user.follower_count ?? 0);
      const avatarUrl = user.avatar_url as string | undefined;

      if (!openId) {
        this.logger.error(`TikTok stats payload missing open_id: ${JSON.stringify(responseBody)}`);
        throw new UnauthorizedException('Invalid stats payload from TikTok');
      }

      return { openId, username, displayName, followerCount, avatarUrl };
    } catch (error) {
      this.logger.error(
        'TikTok getFollowerStats error',
        error instanceof Error ? error.stack : error,
      );
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException('Failed to retrieve TikTok follower stats');
    }
  }
}
