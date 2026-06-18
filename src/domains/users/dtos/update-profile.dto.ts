import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @Length(3, 30)
  username?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  brandName?: string;

  @IsUUID()
  @IsOptional()
  nationalityId?: string;

  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @IsUUID()
  @IsNotEmpty()
  stateId: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  monthlyBudget?: string;
}

export class CreatorProfileDto {
  @ApiProperty({
    description: 'Unique username selected by user',
    example: 'trendsetter_ojima',
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Nationality/citizenship ID from the nationalities lookup.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  nationalityId?: string;

  @ApiProperty({
    description: 'Country ID from the countries lookup. Drives the states dropdown.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  countryId: string;

  @ApiProperty({
    description: 'State ID from the states lookup (filtered by countryId)',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  stateId: string;

  @ApiPropertyOptional({
    description: 'A brief tagline/bio about the user',
    example: 'Exploring lifestyle and fashion trends in Lagos.',
  })
  bio?: string;
}

export class BrandProfileDto {
  @ApiProperty({
    description: 'Brand name',
    example: 'Pepsi Company',
  })
  brandName: string;

  @ApiProperty({
    description: 'Country ID from the countries lookup. Drives the states dropdown.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  countryId: string;

  @ApiProperty({
    description: 'State ID from the states lookup (filtered by countryId)',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  stateId: string;

  @ApiPropertyOptional({
    description: 'City (optional for Brands)',
    example: 'Ikeja',
  })
  city?: string;

  @ApiPropertyOptional({
    description: 'A brief tagline/bio about the brand',
    example: 'Leading beverage company.',
  })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Website URL (optional for Brands)',
    example: 'https://pepsi.com',
  })
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Monthly marketing budget (optional for Brands)',
    example: '$10,000 - $25,000',
  })
  monthlyBudget?: string;
}
