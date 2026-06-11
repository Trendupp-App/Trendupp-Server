import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class InstagramLoginDto {
  @ApiProperty({
    description: 'The temporary Authorization Code received from Instagram',
    example: 'auth_code_xyz123',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'The exact Redirect URI that was used to obtain the authorization code',
    example: 'http://localhost:3000/auth/instagram/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @ApiPropertyOptional({
    description: 'Selected role for new user signup (creator or brand)',
    example: 'creator',
    default: 'creator',
  })
  @IsString()
  @IsOptional()
  role?: string;
}
