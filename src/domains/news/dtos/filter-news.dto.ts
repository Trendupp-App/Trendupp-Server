import { IsOptional, IsString, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class FilterNewsDto {
  @ApiPropertyOptional({ description: 'Search term for title or summary' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    enum: ['draft', 'published'],
    description: 'Filter by status (Admin only)',
  })
  @IsOptional()
  @IsEnum(['draft', 'published'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by industry ID' })
  @IsOptional()
  @IsUUID()
  industryId?: string;

  @ApiPropertyOptional({ description: 'Filter for platform updates' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPlatformUpdate?: boolean;

  @ApiPropertyOptional({ description: 'Filter for top news' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isTopNews?: boolean;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  limit?: number;
}
