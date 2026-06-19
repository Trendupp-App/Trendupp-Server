import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'New campaigns alerts state', example: true })
  @IsBoolean()
  @IsOptional()
  newCampaigns?: boolean;

  @ApiPropertyOptional({ description: 'Application updates alerts state', example: true })
  @IsBoolean()
  @IsOptional()
  applicationUpdates?: boolean;

  @ApiPropertyOptional({ description: 'Payment alerts state', example: true })
  @IsBoolean()
  @IsOptional()
  paymentAlerts?: boolean;

  @ApiPropertyOptional({ description: 'Brand messages alerts state', example: true })
  @IsBoolean()
  @IsOptional()
  brandMessages?: boolean;

  @ApiPropertyOptional({ description: 'Push notifications channels state', example: true })
  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Email notifications channels state', example: true })
  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ description: 'Weekly summary digest state', example: false })
  @IsBoolean()
  @IsOptional()
  weeklySummary?: boolean;

  @ApiPropertyOptional({ description: 'Marketing & offers digest state', example: false })
  @IsBoolean()
  @IsOptional()
  marketingOffers?: boolean;
}
