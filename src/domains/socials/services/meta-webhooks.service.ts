import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { DataDeletionRequest } from '../entities/data-deletion-request.entity';
import { SocialConnectionRepository } from '../repository/social-connection.repository';
import { SocialsService } from './socials.service';
import { UsersService } from '../../users/services/users.service';
import { SocialPlatform } from '../constants/social-platforms';
import { User } from '../../users/entities/user.entity';

export type MetaPlatform = 'instagram' | 'facebook';

interface SignedRequestPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

/**
 * Meta's required app-lifecycle callbacks for Facebook Login and Instagram
 * business login:
 *
 * - **Deauthorize** — fires when a user removes Trendupp from their Facebook/
 *   Instagram settings. We drop the platform connection (their access token is
 *   already dead) but keep the login identity so they can re-authorize later.
 * - **Data deletion** — fires when a user requests deletion of the data we
 *   received from Meta. We delete the platform-derived data and return the
 *   status URL + confirmation code Meta requires.
 *
 * Both are unauthenticated endpoints protected by the `signed_request`
 * HMAC-SHA256 signature, verified against the app secret.
 */
@Injectable()
export class MetaWebhooksService {
  private readonly logger = new Logger(MetaWebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly connectionRepo: SocialConnectionRepository,
    private readonly socialsService: SocialsService,
    private readonly usersService: UsersService,
    @InjectModel(DataDeletionRequest)
    private readonly deletionRequestModel: typeof DataDeletionRequest,
  ) {}

  /**
   * Both Meta apps may sign these callbacks, and Instagram business login has
   * its own secret distinct from the Facebook app secret — accept either.
   */
  private secrets(): string[] {
    return [
      this.configService.get<string>('instagram.appSecret'),
      this.configService.get<string>('facebook.appSecret'),
    ].filter((s): s is string => !!s);
  }

  private static base64UrlDecode(value: string): Buffer {
    return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  /** Verifies Meta's signed_request and returns its payload. */
  verifySignedRequest(signedRequest?: string): SignedRequestPayload {
    if (!signedRequest || !signedRequest.includes('.')) {
      throw new BadRequestException('Missing or malformed signed_request');
    }
    const secrets = this.secrets();
    if (secrets.length === 0) {
      throw new UnauthorizedException('Meta app secrets are not configured on this server');
    }

    const [encodedSignature, encodedPayload] = signedRequest.split('.', 2);
    const signature = MetaWebhooksService.base64UrlDecode(encodedSignature);

    const signatureValid = secrets.some((secret) => {
      const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
      return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
    });
    if (!signatureValid) {
      throw new UnauthorizedException('Invalid signed_request signature');
    }

    try {
      return JSON.parse(
        MetaWebhooksService.base64UrlDecode(encodedPayload).toString('utf8'),
      ) as SignedRequestPayload;
    } catch {
      throw new BadRequestException('Unreadable signed_request payload');
    }
  }

  /** Resolve the Trendupp account behind a platform-scoped user id, if any. */
  private async findUser(platform: MetaPlatform, platformUserId: string): Promise<User | null> {
    const connection = await this.connectionRepo.findByPlatformAccount(
      platform as SocialPlatform,
      platformUserId,
    );
    if (connection) {
      const user = await this.usersService.findOne(connection.userId);
      if (user) return user;
    }
    return platform === 'instagram'
      ? this.usersService.findByInstagramOpenId(platformUserId)
      : this.usersService.findByFacebookOpenId(platformUserId);
  }

  /**
   * User removed the app on Meta's side: drop the verified connection so we
   * stop showing stale follower data. The login identity is intentionally kept
   * — deleting it would lock a social-signup user out of their own account.
   */
  async handleDeauthorize(platform: MetaPlatform, signedRequest?: string): Promise<void> {
    const payload = this.verifySignedRequest(signedRequest);
    const platformUserId = payload.user_id;
    if (!platformUserId) return;

    const user = await this.findUser(platform, platformUserId);
    if (!user) {
      this.logger.log(`${platform} deauthorize for unknown account ${platformUserId} — no-op.`);
      return;
    }

    try {
      await this.socialsService.disconnect(user.id, platform);
      this.logger.log(`${platform} deauthorized by user ${user.id} — connection removed.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${platform} deauthorize cleanup failed for ${user.id}: ${message}`);
    }
  }

  /**
   * Data-deletion request: remove everything we hold that came from Meta —
   * the connection (tokens, username, follower count) and the platform login
   * identifier. Returns the confirmation code Meta shows the user.
   */
  async handleDataDeletion(
    platform: MetaPlatform,
    signedRequest?: string,
  ): Promise<{ url: string; confirmation_code: string }> {
    const payload = this.verifySignedRequest(signedRequest);
    const platformUserId = payload.user_id ?? 'unknown';
    const confirmationCode = crypto.randomBytes(12).toString('hex');

    let status = 'no_data';
    let details: string | null = null;
    let userId: string | null = null;

    try {
      const user = await this.findUser(platform, platformUserId);
      if (user) {
        userId = user.id;
        await this.socialsService.disconnect(user.id, platform);
        await this.usersService.update(user.id, {
          [platform === 'instagram' ? 'instagramOpenId' : 'facebookOpenId']: null,
          [platform === 'instagram' ? 'instagramUsername' : 'facebookUsername']: null,
          [platform === 'instagram' ? 'instagramFollowers' : 'facebookFollowers']: 0,
        });
        status = 'completed';
        details = `Deleted ${platform} connection, profile handle, follower count and login identifier.`;
      } else {
        details = `No Trendupp account is associated with this ${platform} user.`;
      }
    } catch (error: unknown) {
      status = 'failed';
      details = error instanceof Error ? error.message : String(error);
      this.logger.error(`${platform} data deletion failed for ${platformUserId}: ${details}`);
    }

    await this.deletionRequestModel.create({
      confirmationCode,
      platform,
      platformUserId,
      userId,
      status,
      details,
    } as unknown as DataDeletionRequest);

    const webUrl = this.configService.get<string>('app.webUrl', 'https://app.trendupp.com');
    return {
      url: `${webUrl}/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    };
  }

  /** Public status lookup backing the user-facing data-deletion page. */
  async getDeletionStatus(code: string) {
    const request = await this.deletionRequestModel.findOne({
      where: { confirmationCode: code },
    });
    if (!request) return null;
    return {
      confirmationCode: request.confirmationCode,
      platform: request.platform,
      status: request.status,
      details: request.details,
      requestedAt: request.createdAt,
    };
  }
}
