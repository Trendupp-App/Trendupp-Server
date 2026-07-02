import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ConnectSocialDto {
  @ApiProperty({
    description: 'The temporary OAuth authorization code returned to the client by the platform',
    example: 'auth_code_xyz123',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'The exact redirect URI used to obtain the authorization code',
    example: 'https://app.trendupp.com/connect/instagram/callback',
  })
  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @ApiPropertyOptional({
    description: 'PKCE code verifier (required by TikTok and X / Twitter)',
    example: 'some_cryptographically_secure_random_string',
  })
  @IsString()
  @IsOptional()
  codeVerifier?: string;
}
