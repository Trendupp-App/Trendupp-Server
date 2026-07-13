import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsOptional, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../../shared/validators/password.validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password (required if password is set on account)',
    example: 'OldPass123!',
  })
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @ApiProperty({
    description:
      'New password — min 8 characters, must include uppercase, lowercase, digit, and special character',
    example: 'NewPass123!',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100, { message: 'New password must be at least 8 characters long' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  newPassword: string;
}
