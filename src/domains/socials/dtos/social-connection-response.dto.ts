import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SOCIAL_PLATFORMS } from '../constants/social-platforms';

/**
 * Swagger response shapes for the socials endpoints. Mirrors
 * SocialConnectionView / SocialsMutationResult in socials.service.ts —
 * classes (not interfaces) so OpenAPI can introspect them.
 */
export class SocialConnectionViewDto {
  @ApiProperty({ enum: SOCIAL_PLATFORMS, example: 'tiktok' })
  platform: string;

  @ApiProperty({ example: 'TikTok', description: 'Human-friendly platform name' })
  label: string;

  @ApiProperty({ example: true })
  connected: boolean;

  @ApiProperty({ example: true, description: 'Whether the connection was OAuth-verified' })
  verified: boolean;

  @ApiProperty({ example: 'creator_handle', nullable: true, type: String })
  username: string | null;

  @ApiProperty({ example: 15400, description: 'Follower count as verified via the platform API' })
  followerCount: number;

  @ApiProperty({
    example: 'https://p16-sign.tiktokcdn.com/avatar.jpeg',
    nullable: true,
    type: String,
  })
  avatarUrl: string | null;

  @ApiProperty({
    example: 1000,
    description:
      'Minimum followers required to connect this platform (runtime-editable via social_platform_settings)',
  })
  minFollowers: number;

  @ApiProperty({ example: '2026-07-15T13:01:09.000Z', nullable: true, type: String })
  connectedAt: Date | null;
}

export class SocialsMutationResultDto {
  @ApiProperty({ example: 'TikTok connected successfully' })
  message: string;

  @ApiProperty({
    example: 'Micro Creator',
    description: 'Creator tier recomputed from the highest follower count across connections',
  })
  tier: string;

  @ApiProperty({ type: [SocialConnectionViewDto], description: 'All four platform cards' })
  connections: SocialConnectionViewDto[];

  @ApiPropertyOptional({
    type: SocialConnectionViewDto,
    description: 'The platform affected by this mutation (connect only)',
  })
  connection?: SocialConnectionViewDto;
}
