import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class DeactivateAccountDto {
  @ApiPropertyOptional({
    description:
      'Current password to verify account ownership before deactivation (required if account has a password)',
    example: 'SecretPass123!',
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Reason for deactivating / deleting the account',
    example: 'Taking a break from content creation',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
