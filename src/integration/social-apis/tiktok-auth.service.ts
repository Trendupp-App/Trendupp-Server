import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.clientKey = this.configService.get<string>('tiktok.clientKey');
    this.clientSecret = this.configService.get<string>('tiktok.clientSecret');

    this.isMockMode = !this.clientKey || !this.clientSecret;

    if (this.isMockMode) {
      this.logger.warn(
        'TikTok credentials (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET) are missing. TikTok Auth will run in MOCK mode.',
      );
    } else {
      this.logger.log('TikTok Auth Service initialized successfully.');
    }
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<TiktokTokenResponse> {
    if (this.isMockMode || code.startsWith('mock_') || code.startsWith('{')) {
      this.logger.warn(`MOCK mode: Simulating token exchange for code: ${code}`);

      // If code is serialized JSON mock data, try to extract custom ID
      let openId = 'mock-tiktok-open-id-123456789';
      if (code.startsWith('{')) {
        try {
          const parsed = JSON.parse(code) as Record<string, unknown>;
          if (parsed.sub) openId = parsed.sub as string;
          else if (parsed.openId) openId = parsed.openId as string;
        } catch {
          // Fallback to default
        }
      } else if (code.startsWith('mock_')) {
        openId = `mock-tiktok-open-id-${code.replace('mock_', '')}`;
      }

      return {
        accessToken: `mock-tiktok-access-token-${openId}`,
        openId,
      };
    }

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
      throw new UnauthorizedException('Failed to authenticate with TikTok');
    }
  }

  async getUserProfile(accessToken: string): Promise<TiktokUserProfile> {
    if (this.isMockMode || accessToken.startsWith('mock-tiktok-access-token-')) {
      this.logger.warn('MOCK mode: Simulating user profile fetch.');

      let openId = 'mock-tiktok-open-id-123456789';
      let displayName = 'Mock TikTok Creator';

      const parts = accessToken.split('mock-tiktok-access-token-');
      if (parts.length > 1 && parts[1]) {
        openId = parts[1];
        if (openId.includes('brand')) {
          displayName = 'Mock TikTok Brand';
        }
      }

      return {
        openId,
        displayName,
        avatarUrl: 'https://placehold.co/150x150.png',
      };
    }

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
      throw new UnauthorizedException('Failed to retrieve TikTok user profile info');
    }
  }

  /**
   * Fetch the follower count + handle used to *verify* a TikTok connection.
   * Requires the `user.info.stats` (and `user.info.profile`) scopes on the
   * access token. Falls back to deterministic mock data when running without
   * credentials so the connect flow is exercisable end-to-end in dev/test.
   */
  async getFollowerStats(accessToken: string): Promise<TiktokFollowerStats> {
    if (this.isMockMode || accessToken.startsWith('mock-tiktok-access-token-')) {
      this.logger.warn('MOCK mode: Simulating TikTok follower stats fetch.');
      let openId = 'mock-tiktok-open-id-123456789';
      const parts = accessToken.split('mock-tiktok-access-token-');
      if (parts.length > 1 && parts[1]) openId = parts[1];
      return {
        openId,
        username: 'mock_tiktok_creator',
        displayName: 'Mock TikTok Creator',
        followerCount: 15400,
        avatarUrl: 'https://placehold.co/150x150.png',
      };
    }

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
      throw new UnauthorizedException('Failed to retrieve TikTok follower stats');
    }
  }
}
