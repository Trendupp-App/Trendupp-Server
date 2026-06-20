import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Unique username (required for Creators)',
    example: 'trendsetter_ojima',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  @Length(3, 30)
  username?: string;

  @ApiPropertyOptional({
    description: 'Brand name (required for Brands)',
    example: 'Pepsi Company',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  @Length(2, 50)
  brandName?: string;

  @ApiPropertyOptional({
    description: 'Nationality/citizenship ID from lookup (Creators)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  nationalityId?: string;

  @ApiProperty({
    description: 'Country ID from lookup',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({
    description: 'State ID from lookup',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID()
  @IsNotEmpty()
  stateId: string;

  @ApiPropertyOptional({
    description: 'A brief tagline/bio',
    example: 'Exploring lifestyle and fashion.',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  bio?: string;

  @ApiPropertyOptional({ description: 'City name (optional for Brands)', example: 'Ikeja' })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  city?: string;

  @ApiPropertyOptional({
    description: 'Website URL (optional for Brands)',
    example: 'https://pepsi.com',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Monthly marketing budget (optional for Brands)',
    example: '$10,000 - $25,000',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  monthlyBudget?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture / avatar (JPEG, PNG, WebP up to 5MB)',
  })
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  avatar?: any;
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

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture / avatar (JPEG, PNG, WebP up to 5MB)',
  })
  avatar?: any;
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

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture / avatar (JPEG, PNG, WebP up to 5MB)',
  })
  avatar?: any;
}
