import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsArray, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../shared/dtos/pagination.dto';

export class FindAllCampaignsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter campaigns by status',
    enum: ['draft', 'live', 'active', 'completed', 'past', 'social_impact'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'live', 'active', 'completed', 'past', 'social_impact'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Sort campaigns by newest, highest_budget, or closing_soon',
    enum: ['newest', 'highest_budget', 'closing_soon'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'highest_budget', 'closing_soon'])
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Platform names to filter campaigns (array or comma-separated)',
    type: [String],
    example: ['Instagram', 'TikTok'],
  })
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v: unknown) => String(v).trim());
    if (typeof value === 'string') return value.split(',').map((s) => s.trim());
    return undefined;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @ApiPropertyOptional({
    description: 'Niche names to filter campaigns (array or comma-separated)',
    type: [String],
    example: ['Fashion', 'Tech'],
  })
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v: unknown) => String(v).trim());
    if (typeof value === 'string') return value.split(',').map((s) => s.trim());
    return undefined;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niches?: string[];

  @ApiPropertyOptional({
    description: 'Niche UUIDs to filter campaigns (array or comma-separated)',
    type: [String],
  })
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v: unknown) => String(v).trim());
    if (typeof value === 'string') return value.split(',').map((s) => s.trim());
    return undefined;
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  nicheIds?: string[];

  @ApiPropertyOptional({
    description: 'Campaign goal to filter campaigns (Create Content or Amplify Content)',
    enum: ['Create Content', 'Amplify Content', 'Content Creation', 'Amplification'],
  })
  @IsOptional()
  @IsString()
  goal?: string;
}
