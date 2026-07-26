import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({ example: 'ADMIN_CREATED', description: 'Filter by action name' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Filter by admin user ID' })
  @IsOptional()
  @IsString()
  adminId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Filter by target user ID' })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Filter to actions whose route targeted this campaign (details.params.id)',
  })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({
    example: 'suspend',
    description: 'Free-text search across the action name',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '2026-07-01', description: 'Start date ISO string' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31', description: 'End date ISO string' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
