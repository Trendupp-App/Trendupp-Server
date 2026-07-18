import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!', description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({ example: 'NewSecret123!', description: 'New password' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;

  @ApiProperty({ example: 'NewSecret123!', description: 'Confirm new password' })
  @IsString()
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword: string;
}
