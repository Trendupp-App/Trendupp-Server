import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({
    description:
      'The Sign in with Apple identity token (JWT), from the native iOS credential or ' +
      'the web authorize response',
  })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional({
    description:
      'Given name from the Apple credential. Apple only provides the name on the very ' +
      'first authorization, so clients must forward it then.',
    example: 'Ada',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Family name from the Apple credential (first authorization only)',
    example: 'Obi',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Selected role for new user signup (creator or brand)',
    example: 'creator',
    default: 'creator',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    description: 'Acceptance of terms and conditions',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  acceptedTerms?: boolean;

  @ApiPropertyOptional({
    description: 'Acceptance of promotional emails',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  acceptedPromotions?: boolean;
}
