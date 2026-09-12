import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export enum AdTypeEnum {
  BANNER = 'Banner',
  SPONSORED = 'Sponsored',
  ANNOUNCEMENT = 'Announcement',
}

export enum AdStatusEnum {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SCHEDULED = 'scheduled',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export class CreateBannerAdDto {
  @ApiProperty({ example: 'Creator Workshop Series — Register Now' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: AdTypeEnum, example: AdTypeEnum.BANNER })
  @IsString()
  @IsNotEmpty()
  adType: string;

  @ApiProperty({ example: ['All Creators'], type: [String] })
  @Transform(({ value }: { value: unknown }): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v).trim());
    if (typeof value === 'string') {
      const trimmed = value.trim();
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim());
      } catch {
        // ignore
      }
      if (trimmed.includes(','))
        return trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      return [trimmed];
    }
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  targetAudience: string[];

  @ApiProperty({ example: ['Home Page'], type: [String] })
  @Transform(({ value }: { value: unknown }): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v).trim());
    if (typeof value === 'string') {
      const trimmed = value.trim();
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim());
      } catch {
        // ignore
      }
      if (trimmed.includes(','))
        return trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      return [trimmed];
    }
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  placement: string[];

  @ApiPropertyOptional({
    description: 'Banner ad image file (upload binary file)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  adImage?: any;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1781445074433' })
  @IsOptional()
  @IsString()
  adImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://trendupp.com/workshops' })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AdStatusEnum, example: AdStatusEnum.DRAFT })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateBannerAdDto extends PartialType(CreateBannerAdDto) {}

export class UpdateBannerAdStatusDto {
  @ApiProperty({ enum: AdStatusEnum, example: AdStatusEnum.PAUSED })
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class QueryBannerAdsDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Home Page' })
  @IsOptional()
  @IsString()
  placement?: string;

  @ApiPropertyOptional({ example: 'Workshop' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class BannerAdSummaryResponseDto {
  @ApiProperty({ example: 2 })
  totalActiveAds: number;

  @ApiProperty({ example: '92.7K' })
  totalImpressions: string;

  @ApiProperty({ example: '7.4%' })
  clickThroughRate: string;

  @ApiProperty({ example: 3 })
  adsExpiringSoon: number;
}
