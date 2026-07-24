import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ─── Commission DTOs ─────────────────────────────────────────────────────────

export class CreateCommissionTierDto {
  @ApiProperty({ example: 'High-Volume Partner Rate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercentage: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'Special rate for top brand partners' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: ['brand-uuid-1', 'brand-uuid-2'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];
}

export class UpdateCommissionTierDto extends PartialType(CreateCommissionTierDto) {}

// ─── FAQ DTOs ────────────────────────────────────────────────────────────────

export class CreateFaqDto {
  @ApiProperty({ example: 'How does escrow work on Trendupp?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'Escrow on Trendupp means campaign funds are held securely...' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiProperty({ example: 'Payments' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: 'published' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class QueryFaqsDto {
  @ApiPropertyOptional({ example: 'Payments' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'published' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'escrow' })
  @IsOptional()
  @IsString()
  search?: string;
}

// ─── News Category DTOs ──────────────────────────────────────────────────────

export class CreateNewsCategoryDto {
  @ApiProperty({ example: 'Platform Update' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateNewsCategoryDto extends PartialType(CreateNewsCategoryDto) {}

// ─── Niche & Industry DTOs ───────────────────────────────────────────────────

export class CreateNicheDto {
  @ApiProperty({ example: 'Cryptocurrency' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateNicheDto extends PartialType(CreateNicheDto) {}

export class CreateIndustryDto {
  @ApiProperty({ example: 'Fintech' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateIndustryDto extends PartialType(CreateIndustryDto) {}

// ─── Contact Info DTO ────────────────────────────────────────────────────────

export class UpdateContactInfoDto {
  @ApiProperty({ example: '12 Marina Way, Lagos Island, Lagos, Nigeria' })
  @IsString()
  @IsNotEmpty()
  businessAddress: string;

  @ApiProperty({ example: 'support@trendupp.com' })
  @IsEmail()
  @IsNotEmpty()
  supportEmail: string;

  @ApiProperty({ example: '+234 800 TRENDUPP' })
  @IsString()
  @IsNotEmpty()
  supportPhone: string;
}

// ─── External Links DTO ──────────────────────────────────────────────────────

export class UpdateExternalLinksDto {
  @ApiPropertyOptional({ example: 'https://trendupp.com' })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: '@trendupp' })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiPropertyOptional({ example: '@trendupp_ng' })
  @IsOptional()
  @IsString()
  twitter?: string;

  @ApiPropertyOptional({ example: 'trendupp' })
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional({ example: 'TrenduppAfrica' })
  @IsOptional()
  @IsString()
  youtube?: string;
}

// ─── Change Password DTO ─────────────────────────────────────────────────────

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
