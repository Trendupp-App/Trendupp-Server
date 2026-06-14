import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Unique username selected by user',
    example: 'trendsetter_ojima',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 30)
  username: string;

  @ApiPropertyOptional({
    description:
      'Nationality/citizenship ID from the nationalities lookup. Optional — represents passport/citizenship.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsOptional()
  nationalityId?: string;

  @ApiProperty({
    description:
      'Country ID from the countries lookup (same data as nationalities). Required — represents the country the user currently lives/operates in. Drives the states dropdown.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({
    description: 'State ID from the states lookup (filtered by countryId)',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID()
  @IsNotEmpty()
  stateId: string;

  @ApiPropertyOptional({
    description: 'A brief tagline/bio about the user',
    example: 'Exploring lifestyle and fashion trends in Lagos.',
  })
  @IsString()
  @IsOptional()
  bio?: string;
}
