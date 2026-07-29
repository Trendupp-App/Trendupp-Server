import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySocialImpactCampaignsDto {
  @ApiPropertyOptional({
    example: 'active',
    enum: ['all', 'active', 'completed'],
    description: 'Filter campaigns by tab status',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'active', 'completed'])
  tab?: 'all' | 'active' | 'completed' = 'active';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
