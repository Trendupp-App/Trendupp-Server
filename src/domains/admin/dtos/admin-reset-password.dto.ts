import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../../shared/validators/password.validator';

export class AdminResetPasswordDto {
  @ApiProperty({
    example: 'admin@trendupp.com',
    description: 'Admin registered email address',
  })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'NewSecret123!',
    description:
      'New password — min 8 characters, must include uppercase, lowercase, number, and special character',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
