import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password (required if password is set on account)',
    example: 'OldPass123!',
  })
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @ApiProperty({
    description: 'New password (min 8 characters)',
    example: 'NewPass123!',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}
