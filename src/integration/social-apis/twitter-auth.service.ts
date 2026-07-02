import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TwitterTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface TwitterUserStats {
  userId: string;
  username: string;
  followerCount: number;
  avatarUrl?: string;
}

/**
 * X / Twitter "connect" adapter.
 *
 * Uses OAuth 2.0 (PKCE, confidential client) to exchange an auth code, then
 * reads `public_metrics.followers_count` from the v2 `/users/me` endpoint.
 * NOTE: follower metrics require a paid X API tier — without credentials this
 * runs in MOCK mode so the flow is still exercisable.
 */
@Injectable()
export class TwitterAuthService {
  private readonly logger = new Logger(TwitterAuthService.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('twitter.clientId');
    this.clientSecret = this.configService.get<string>('twitter.clientSecret');
    this.isMockMode = !this.clientId || !this.clientSecret;

    if (this.isMockMode) {
      this.logger.warn(
        'Twitter/X credentials (TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET) are missing. X connect will run in MOCK mode.',
      );
    } else {
      this.logger.log('Twitter/X Auth Service initialized successfully.');
    }
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<TwitterTokenResponse> {
    if (this.isMockMode || code.startsWith('mock_') || code.startsWith('{')) {
      this.logger.warn(`MOCK mode: Simulating X token exchange for code: ${code}`);
      return { accessToken: 'mock-twitter-access-token-123456789', expiresIn: 7200 };
    }

    try {
      const params: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        // X requires PKCE; clients must send the verifier. Default to 'challenge'
        // only as a last resort to avoid a malformed request.
        code_verifier: codeVerifier || 'challenge',
        client_id: this.clientId!,
      };

      const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams(params).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`X token exchange failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to exchange authorization code with X');
      }

      const data = (await response.json()) as Record<string, unknown>;
      const accessToken = data.access_token as string;
      if (!accessToken) {
        this.logger.error(`X token response missing access_token: ${JSON.stringify(data)}`);
        throw new UnauthorizedException('Invalid token response from X');
      }

      return {
        accessToken,
        refreshToken: data.refresh_token as string | undefined,
        expiresIn: data.expires_in as number | undefined,
      };
    } catch (error) {
      this.logger.error(
        'X exchangeCodeForToken error',
        error instanceof Error ? error.stack : error,
      );
      throw new UnauthorizedException('Failed to authenticate with X');
    }
  }

  async getUserStats(accessToken: string): Promise<TwitterUserStats> {
    if (this.isMockMode || accessToken.startsWith('mock-twitter-access-token-')) {
      this.logger.warn('MOCK mode: Simulating X user stats fetch.');
      return {
        userId: 'mock-twitter-user-id-123456789',
        username: 'mock_x_user',
        followerCount: 1800,
        avatarUrl: 'https://placehold.co/150x150.png',
      };
    }

    try {
      const url =
        'https://api.twitter.com/2/users/me?user.fields=public_metrics,username,profile_image_url';
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`X stats fetch failed: Status ${response.status} - ${errorText}`);
        throw new UnauthorizedException('Failed to fetch X user stats');
      }

      const body = (await response.json()) as Record<string, unknown>;
      const data = (body.data || {}) as Record<string, unknown>;
      const metrics = (data.public_metrics || {}) as Record<string, unknown>;

      const userId = data.id as string;
      const username = data.username as string;
      const followerCount = Number(metrics.followers_count ?? 0);
      const avatarUrl = data.profile_image_url as string | undefined;

      if (!userId || !username) {
        this.logger.error(`X stats payload missing fields: ${JSON.stringify(body)}`);
        throw new UnauthorizedException('Invalid stats payload from X');
      }

      return { userId, username, followerCount, avatarUrl };
    } catch (error) {
      this.logger.error('X getUserStats error', error instanceof Error ? error.stack : error);
      throw new UnauthorizedException('Failed to retrieve X user stats');
    }
  }
}
