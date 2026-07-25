import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

export interface AppleIdentity {
  /** Apple's stable per-team user identifier (`sub`). */
  appleUserId: string;
  /** Real or private-relay address; both are deliverable. May be absent. */
  email?: string;
  emailVerified: boolean;
}

/**
 * Verifies Sign in with Apple identity tokens against Apple's JWKS.
 *
 * There is no code exchange here: both clients hand us the identity token
 * directly (iOS native from `sign_in_with_apple`, web from the fragment
 * response of appleid.apple.com/auth/authorize). Audience is whitelisted via
 * APPLE_CLIENT_IDS — the iOS bundle id and the web Services ID.
 */
@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);
  private readonly clientIds: string[];
  private readonly jwks = createRemoteJWKSet(APPLE_JWKS_URL);

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('apple.clientIds') ?? '';
    this.clientIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (this.clientIds.length === 0) {
      this.logger.warn(
        'Apple client ids (APPLE_CLIENT_IDS) are missing. Apple sign-in will fail until they are set.',
      );
    } else {
      this.logger.log('Apple Auth Service initialized successfully.');
    }
  }

  async verifyIdentityToken(identityToken: string): Promise<AppleIdentity> {
    if (this.clientIds.length === 0) {
      throw new ServiceUnavailableException(
        'Apple sign-in is not configured on this server (APPLE_CLIENT_IDS)',
      );
    }

    try {
      const { payload } = await jwtVerify(identityToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.clientIds,
      });

      if (!payload.sub) {
        throw new Error('identity token has no subject');
      }

      return {
        appleUserId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        // Apple sends email_verified as a boolean or the string "true".
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Apple identity token verification failed: ${message}`);
      throw new UnauthorizedException('Apple authentication failed');
    }
  }
}
