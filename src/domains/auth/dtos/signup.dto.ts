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

  @ApiPropertyOptional({
    description: 'User role (creator or advertiser)',
    default: '4412ed7f-95db-4f31-ad90-df6e7d96dcd5',
  })
  @IsOptional()
  role?: string;

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

export class CreatorSignupDto extends SignupDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'Ojima',
  })
  @IsString()
  @IsNotEmpty()
  declare firstName?: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Attah',
  })
  @IsString()
  @IsNotEmpty()
  declare lastName?: string;
}

export class BrandSignupDto extends SignupDto {
  @ApiProperty({
    description: 'Brand name (required if signing up as a Brand)',
    example: 'Trendupp Inc.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  declare brandName?: string;
}
