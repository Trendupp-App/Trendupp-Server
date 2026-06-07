import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'The email address where the OTP will be sent',
    example: 'user@trendupp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
