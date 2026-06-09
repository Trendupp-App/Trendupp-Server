import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly oauthClient: OAuth2Client;
  private readonly clientIds: string[];

  constructor(private readonly configService: ConfigService) {
    const webId = this.configService.get<string>('google.clientIdWeb');
    const iosId = this.configService.get<string>('google.clientIdIos');
    const androidId = this.configService.get<string>('google.clientIdAndroid');

    this.clientIds = [webId, iosId, androidId].filter((id): id is string => !!id);
    this.oauthClient = new OAuth2Client();

    if (this.clientIds.length === 0) {
      this.logger.warn(
        'Google Client IDs are missing. Google Auth will run in MOCK mode (for testing).',
      );
    } else {
      this.logger.log(
        `Google Auth Service initialized with ${this.clientIds.length} Client ID(s).`,
      );
    }
  }

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    // Mock mode bypass when no client IDs are configured (useful for development and testing)
    if (this.clientIds.length === 0) {
      this.logger.warn(`MOCK mode: Simulating verification for token.`);
      if (idToken.startsWith('{') || idToken.includes('.')) {
        try {
          if (idToken.startsWith('{')) {
            return JSON.parse(idToken) as TokenPayload;
          }
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
            return JSON.parse(decoded) as TokenPayload;
          }
        } catch {
          // Fallback to default mock payload below on parse failure
        }
      }
      return {
        sub: 'mock-google-id-123456789',
        email: 'mock-user@gmail.com',
        email_verified: true,
        name: 'Mock Google User',
        given_name: 'Mock',
        family_name: 'Google User',
        iss: 'accounts.google.com',
        aud: 'mock-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.clientIds,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID Token payload');
      }

      if (!payload.email) {
        throw new UnauthorizedException('Google ID Token does not contain an email');
      }

      return payload;
    } catch (error) {
      const stack = error instanceof Error ? error.stack : '';
      this.logger.error('Google ID Token verification failed', stack);
      throw new UnauthorizedException('Invalid Google ID Token');
    }
  }
}
