import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'The registered email address',
    example: 'creator@trendupp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The account password',
    example: 'P@ssword123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
