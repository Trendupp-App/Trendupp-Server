import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'admin@trendupp.com', description: 'Admin email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit verification OTP code' })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  code: string;

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
