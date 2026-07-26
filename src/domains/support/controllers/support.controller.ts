import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

/** Social-login placeholder addresses — undeliverable, flagged to agents. */
const SYNTHETIC_EMAIL_PATTERN = /@trendupp\.(tiktok|instagram|facebook|apple)$/i;

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly configService: ConfigService) {}

  @Get('asap-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mint a Zoho Desk ASAP user token for the signed-in user',
    description:
      'Short-lived JWT (HS256, 10 min) signed with the ASAP shared secret. The web widget and ' +
      'mobile SDK exchange it with Zoho so support tickets attach to the Trendupp account. ' +
      'Claim names follow the ASAP JWT authentication mechanism configured in the Desk portal.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { token: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 503, description: 'Zoho ASAP is not configured on this server' })
  getAsapToken(@CurrentUser() user: User) {
    const secret = this.configService.get<string>('zoho.asapSecret');
    if (!secret) {
      throw new ServiceUnavailableException(
        'Support is not configured on this server (ZOHO_ASAP_SECRET)',
      );
    }

    // Claim names and format follow Zoho's enhanced ASAP JWT mechanism:
    // email, email_verified, first_name/last_name (optional), and a
    // not_before/not_after validity window in UTC milliseconds capped at
    // 10 minutes. Signing must be HS256.
    const now = Date.now();
    const token = jwt.sign(
      {
        email: user.email,
        // Synthetic social-login addresses are internally "verified" but
        // undeliverable — reported unverified so Desk treats them cautiously.
        email_verified: user.isEmailVerified && !SYNTHETIC_EMAIL_PATTERN.test(user.email),
        first_name: user.firstName || undefined,
        last_name: user.lastName || undefined,
        not_before: now,
        not_after: now + 10 * 60 * 1000,
      },
      secret,
      { algorithm: 'HS256' },
    );

    return { token };
  }
}
