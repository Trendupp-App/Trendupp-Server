import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ description: 'Two factor authentication state', example: false })
  @IsBoolean()
  @IsOptional()
  twoFactorEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Biometric login state', example: true })
  @IsBoolean()
  @IsOptional()
  biometricLoginEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Login alerts state', example: true })
  @IsBoolean()
  @IsOptional()
  loginAlertsEnabled?: boolean;
}
