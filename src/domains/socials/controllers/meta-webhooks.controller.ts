import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MetaWebhooksService } from '../services/meta-webhooks.service';
import type { MetaPlatform } from '../services/meta-webhooks.service';

interface SignedRequestBody {
  signed_request?: string;
}

/**
 * Meta app-lifecycle callbacks (Facebook Login + Instagram business login).
 * Public by design — Meta calls them server-to-server; authenticity comes from
 * the signed_request HMAC, not from a session.
 *
 * Paste these into the Meta app settings:
 *   Deauthorize callback URL:      <api>/webhooks/meta/instagram/deauthorize
 *   Data deletion request URL:     <api>/webhooks/meta/instagram/data-deletion
 * (and the /facebook/ variants for the Facebook Login product).
 */
@ApiTags('webhooks')
@Controller('webhooks/meta')
export class MetaWebhooksController {
  constructor(private readonly metaWebhooks: MetaWebhooksService) {}

  @Post(':platform/deauthorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Meta] Deauthorize callback — user removed Trendupp from Facebook/Instagram',
  })
  async deauthorize(
    @Param('platform') platform: MetaPlatform,
    @Body() body: SignedRequestBody,
  ): Promise<{ success: true }> {
    await this.metaWebhooks.handleDeauthorize(platform, body?.signed_request);
    return { success: true };
  }

  @Post(':platform/data-deletion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Meta] Data deletion request callback — returns status URL + confirmation code',
  })
  async dataDeletion(
    @Param('platform') platform: MetaPlatform,
    @Body() body: SignedRequestBody,
  ): Promise<{ url: string; confirmation_code: string }> {
    return this.metaWebhooks.handleDataDeletion(platform, body?.signed_request);
  }

  @Get('data-deletion/:code')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async status(@Param('code') code: string) {
    const status = await this.metaWebhooks.getDeletionStatus(code);
    return status ?? { status: 'not_found' };
  }
}
