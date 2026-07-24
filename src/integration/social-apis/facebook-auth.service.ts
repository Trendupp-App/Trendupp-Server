import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH_BASE = 'https://graph.facebook.com/v23.0';

export interface FacebookTokenResponse {
  accessToken: string;
  expiresIn?: number;
}

export interface FacebookUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  name: string;
}

export interface FacebookFollowerStats {
  id: string;
  username: string;
  avatarUrl?: string;
  /** Highest follower/fan count across the Pages the user manages (0 if none). */
  followerCount: number;
}

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);
  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('facebook.appId');
    this.appSecret = this.configService.get<string>('facebook.appSecret');

    this.isConfigured = Boolean(this.appId && this.appSecret);

    if (!this.isConfigured) {
      this.logger.warn(
        'Facebook credentials (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET) are missing. Facebook requests will fail until they are set.',
      );
    } else {
      this.logger.log('Facebook Auth Service initialized successfully.');
    }
  }

  /** No mock mode: every call requires real platform credentials. */
  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Facebook integration is not configured on this server (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET)',
      );
    }
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<FacebookTokenResponse> {
    this.assertConfigured();

    const params = new URLSearchParams({
      client_id: this.appId!,
      client_secret: this.appSecret!,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!response.ok || !data.access_token) {
      this.logger.error(
        `Facebook token exchange failed (${response.status}): ${data.error?.message ?? 'no access_token'}`,
      );
      throw new UnauthorizedException('Facebook authentication failed');
    }

    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  async getUserProfile(accessToken: string): Promise<FacebookUserProfile> {
    this.assertConfigured();

    const params = new URLSearchParams({
      fields: 'id,first_name,last_name,name,email',
      access_token: accessToken,
    });
    const response = await fetch(`${GRAPH_BASE}/me?${params.toString()}`);
    const data = (await response.json()) as {
      id?: string;
      first_name?: string;
      last_name?: string;
      name?: string;
      email?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.id) {
      this.logger.error(
        `Facebook profile fetch failed (${response.status}): ${data.error?.message ?? 'no id'}`,
      );
      throw new HttpException('Could not fetch Facebook profile', 502);
    }

    return {
      id: data.id,
      firstName: data.first_name || data.name || 'Facebook',
      lastName: data.last_name || '',
      name: data.name || '',
      email: data.email,
    };
  }

  /**
   * Follower stats for the "connect socials" flow. Regular Facebook profiles
   * expose no follower count via the Graph API, so we take the highest
   * follower/fan count across the Pages the user manages (creators run Pages).
   * Users with no Page get 0 and fail the minimum-follower gate with a clear
   * message from the socials service.
   */
  async getFollowerStats(accessToken: string): Promise<FacebookFollowerStats> {
    this.assertConfigured();

    const profileParams = new URLSearchParams({
      fields: 'id,name,picture.type(large)',
      access_token: accessToken,
    });
    const profileResponse = await fetch(`${GRAPH_BASE}/me?${profileParams.toString()}`);
    const profile = (await profileResponse.json()) as {
      id?: string;
      name?: string;
      picture?: { data?: { url?: string } };
      error?: { message?: string };
    };
    if (!profileResponse.ok || !profile.id) {
      this.logger.error(
        `Facebook profile fetch failed (${profileResponse.status}): ${profile.error?.message ?? 'no id'}`,
      );
      throw new HttpException('Could not fetch Facebook profile', 502);
    }

    const pagesParams = new URLSearchParams({
      fields: 'name,followers_count,fan_count',
      access_token: accessToken,
    });
    const pagesResponse = await fetch(`${GRAPH_BASE}/me/accounts?${pagesParams.toString()}`);
    const pages = (await pagesResponse.json()) as {
      data?: { name?: string; followers_count?: number; fan_count?: number }[];
      error?: { message?: string };
    };

    let followerCount = 0;
    let pageName: string | undefined;
    if (pagesResponse.ok && Array.isArray(pages.data)) {
      for (const page of pages.data) {
        const count = page.followers_count ?? page.fan_count ?? 0;
        if (count > followerCount) {
          followerCount = count;
          pageName = page.name;
        }
      }
    } else if (!pagesResponse.ok) {
      this.logger.warn(
        `Facebook pages fetch failed (${pagesResponse.status}): ${pages.error?.message ?? ''} — treating as 0 followers`,
      );
    }

    return {
      id: profile.id,
      // Prefer the Page name (the creator's public identity) over the personal profile name.
      username: pageName || profile.name || profile.id,
      avatarUrl: profile.picture?.data?.url,
      followerCount,
    };
  }
}
