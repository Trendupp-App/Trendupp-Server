import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  Equals,
  IsBoolean,
  Length,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'creator@trendupp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The password (minimum 8 characters)',
    example: 'P@ssword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description: 'First name of the user',
    example: 'Ojima',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name of the user',
    example: 'Attah',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Brand name (required if signing up as a Brand)',
    example: 'Trendupp Inc.',
  })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  brandName?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the user',
    example: '+2348012345678',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    description: 'User account type — must be either "creator" or "brand"',
    example: 'creator',
    enum: ['creator', 'brand'],
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Acceptance of terms and conditions',
    example: true,
  })
  @Equals(true, { message: 'Terms and conditions must be accepted' })
  @IsNotEmpty()
  acceptedTerms: boolean;

  @ApiPropertyOptional({
    description: 'Acceptance of promotional emails',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  acceptedPromotions?: boolean;
}

/**
 * Swagger-only schema for Creator signup.
 * Independent from SignupDto — only shows fields relevant to creators.
 */
export class CreatorSignupDto {
  @ApiProperty({ description: 'Email address', example: 'creator@trendupp.com' })
  email: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'P@ssword123',
    minLength: 8,
  })
  password: string;

  @ApiProperty({ description: 'First name of the creator', example: 'Ojima' })
  firstName: string;

  @ApiProperty({ description: 'Last name of the creator', example: 'Attah' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Account type — must be "creator"',
    example: 'creator',
    enum: ['creator'],
  })
  role: string;

  @ApiProperty({ description: 'Must accept terms and conditions', example: true })
  acceptedTerms: boolean;

  @ApiPropertyOptional({ description: 'Opt in to promotional emails', example: false })
  acceptedPromotions?: boolean;
}

/**
 * Swagger-only schema for Brand signup.
 * Independent from SignupDto — only shows fields relevant to brands.
 */
export class BrandSignupDto {
  @ApiProperty({ description: 'Email address', example: 'brand@trendupp.com' })
  email: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'P@ssword123',
    minLength: 8,
  })
  password: string;

  @ApiProperty({
    description: 'Official brand / company name',
    example: 'Trendupp Inc.',
    minLength: 2,
    maxLength: 50,
  })
  brandName: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Account type — must be "brand"',
    example: 'brand',
    enum: ['brand'],
  })
  role: string;

  @ApiProperty({ description: 'Must accept terms and conditions', example: true })
  acceptedTerms: boolean;

  @ApiPropertyOptional({ description: 'Opt in to promotional emails', example: false })
  acceptedPromotions?: boolean;
}
