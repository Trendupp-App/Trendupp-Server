import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength, Matches } from 'class-validator';
import {
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../../shared/validators/password.validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'The email address associated with the account',
    example: 'creator@trendupp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The 6-digit verification code received by the user',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description:
      'The new password — min 8 characters, must include uppercase, lowercase, digit, and special character',
    example: 'NewP@ssword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  @IsNotEmpty()
  newPassword: string;
}
