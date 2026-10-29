import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCampaignAccessDto {
  @ApiProperty({
    example: false,
    description: 'Whether the creator is permitted to apply to new campaigns',
  })
  @IsBoolean()
  canApply: boolean;

  @ApiPropertyOptional({
    example: 'Too many unresolved revisions or guidelines violation.',
    description: 'Reason for suspending or reactivating campaign access',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SuspendUserDto {
  @ApiPropertyOptional({
    example: 'Suspicious profile activity or pending investigation.',
    description: 'Reason for suspending the user account',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BanUserDto {
  @ApiPropertyOptional({
    example: 'Severe terms of service violation (fraud / scamming).',
    description: 'Reason for permanently banning the user account',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ModeratedUserSummaryDto {
  @ApiProperty({ example: 'b0e9a826-665a-4933-913a-ff19e347adbb' })
  id: string;

  @ApiProperty({ example: 'Sarah Connor' })
  name: string;

  @ApiProperty({ example: 'sarah@example.com' })
  email: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  canApplyToCampaigns: boolean;

  @ApiProperty({ example: false })
  isBanned: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  bannedAt?: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  banReason?: string | null;
}

export class AdminModerationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Action performed successfully' })
  message: string;

  @ApiProperty({ type: ModeratedUserSummaryDto })
  user: ModeratedUserSummaryDto;
}
