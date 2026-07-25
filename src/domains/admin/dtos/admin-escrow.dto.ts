import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEscrowOverviewDto {
  @ApiPropertyOptional({ example: 2026, description: 'Year for monthly chart metrics' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class QueryEscrowBalancesDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search query for campaign or brand' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: ['this_month', 'last_month', 'custom'],
    description: 'Date preset filter',
  })
  @IsOptional()
  @IsEnum(['this_month', 'last_month', 'custom'])
  datePreset?: string;

  @ApiPropertyOptional({ description: 'Filter start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter end date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class QueryCreatorPayoutsDto extends QueryEscrowBalancesDto {
  @ApiPropertyOptional({ description: 'Filter by Campaign ID' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand ID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by Creator ID' })
  @IsOptional()
  @IsString()
  creatorId?: string;

  @ApiPropertyOptional({
    enum: ['all', 'pending', 'successful', 'failed', 'on_hold'],
    description: 'Filter by payout status',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class QueryAdvertiserRefundsDto extends QueryEscrowBalancesDto {
  @ApiPropertyOptional({ description: 'Filter by Campaign ID' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand ID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    enum: ['all', 'pending', 'successful', 'failed', 'on_hold'],
    description: 'Filter by refund status',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
