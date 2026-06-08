import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'The Google ID Token received on the frontend',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({
    description: 'Selected role for new user signup (creator or brand)',
    example: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
    default: 'creator',
  })
  @IsString()
  @IsOptional()
  role?: string;
}
