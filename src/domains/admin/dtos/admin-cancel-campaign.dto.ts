import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelAdminCampaignDto {
  @ApiPropertyOptional({
    example: 'Client requested campaign cancellation per terms of agreement',
    description: 'Reason for campaign cancellation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PauseAdminCampaignDto {
  @ApiPropertyOptional({
    example: 'Temporary pause requested by brand due to strategy review',
    description: 'Reason for pausing campaign',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
