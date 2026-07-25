import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../shared/dtos/pagination.dto';

const CATEGORIES = [
  'campaigns',
  'applications',
  'payments',
  'chatDispute',
  'account',
  'security',
  'opportunities',
  'broadcast',
] as const;

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only return unread notifications', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by category', enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: string;
}
