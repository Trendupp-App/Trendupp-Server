import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryAdminUsersDto {
  @ApiPropertyOptional({ example: 'sarah', description: 'Search term for name or email' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    example: 'finance_admin',
    enum: ['owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent'],
    description: 'Filter by assigned role',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by account status (true/false)' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): boolean | undefined => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

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
