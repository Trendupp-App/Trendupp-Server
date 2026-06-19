import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstagramTokenResponse {
  accessToken: string;
  userId: string;
}

export interface InstagramUserProfile {
  id: string;
  username: string;
}

@Injectable()
export class InstagramAuthService {
  private readonly logger = new Logger(InstagramAuthService.name);
  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly isMockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('instagram.appId');
    this.appSecret = this.configService.get<string>('instagram.appSecret');

    this.isMockMode = !this.appId || !this.appSecret;

    if (this.isMockMode) {
      this.logger.warn(
        'Instagram credentials (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET) are missing. Instagram Auth will run in MOCK mode.',
      );
    } else {
      this.logger.log('Instagram Auth Service initialized successfully.');
    }
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<InstagramTokenResponse> {
    if (this.isMockMode || code.startsWith('mock_') || code.startsWith('{')) {
      this.logger.warn(`MOCK mode: Simulating token exchange for code: ${code}`);

      let userId = 'mock-instagram-user-id-123456789';
      if (code.startsWith('{')) {
        try {
          const parsed = JSON.parse(code) as Record<string, unknown>;
          const idVal = parsed.id ?? parsed.userId ?? parsed.sub;
          if (typeof idVal === 'string' || typeof idVal === 'number') {
            userId = String(idVal);
          }
        } catch {
          // Fallback
        }
      } else if (code.startsWith('mock_')) {
        userId = `mock-instagram-user-id-${code.replace('mock_', '')}`;
      }

      return {
        accessToken: `mock-instagram-access-token-${userId}`,
        userId,
      };
    }

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
    if (this.isMockMode || accessToken.startsWith('mock-instagram-access-token-')) {
      this.logger.warn('MOCK mode: Simulating user profile fetch.');

      let id = 'mock-instagram-user-id-123456789';
      let username = 'mock_instagram_user';

      const parts = accessToken.split('mock-instagram-access-token-');
      if (parts.length > 1 && parts[1]) {
        id = parts[1];
        username = `mock_instagram_user_${id}`;
      }

      return { id, username };
    }

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
}
