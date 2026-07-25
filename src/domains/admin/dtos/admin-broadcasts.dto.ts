import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type BroadcastAudience = 'all' | 'brands' | 'creators';
export type BroadcastChannel = 'in_app' | 'email' | 'both';
export type BroadcastStatus = 'draft' | 'sent' | 'scheduled' | 'failed';

export class CreateBroadcastDto {
  @ApiProperty({
    example: 'Platform Maintenance Notice',
    description: 'Title of the broadcast notification',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    example: 'We will be performing scheduled maintenance on June 4th...',
    description: 'Message body of the notification',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @ApiProperty({
    enum: ['all', 'brands', 'creators'],
    example: 'all',
    description: 'Target audience for the broadcast',
  })
  @IsEnum(['all', 'brands', 'creators'], {
    message: 'Audience must be either "all", "brands", or "creators"',
  })
  audience: BroadcastAudience;

  @ApiProperty({
    enum: ['in_app', 'email', 'both'],
    example: 'in_app',
    description: 'Delivery channel for the broadcast',
  })
  @IsEnum(['in_app', 'email', 'both'], {
    message: 'Channel must be either "in_app", "email", or "both"',
  })
  channel: BroadcastChannel;

  @ApiProperty({
    enum: ['draft', 'sent', 'scheduled'],
    example: 'sent',
    description: 'Status/Action for the broadcast',
  })
  @IsEnum(['draft', 'sent', 'scheduled'], {
    message: 'Status must be "draft", "sent", or "scheduled"',
  })
  status: BroadcastStatus;

  @ApiPropertyOptional({
    example: '2026-08-01T10:00:00.000Z',
    description: 'Scheduled date and time if status is scheduled',
  })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt must be a valid ISO date string' })
  scheduledAt?: string;
}

export class UpdateBroadcastDto extends PartialType(CreateBroadcastDto) {}

export class QueryAdminBroadcastsDto {
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

  @ApiPropertyOptional({
    enum: ['all', 'draft', 'sent', 'scheduled'],
    description: 'Filter by status tab',
  })
  @IsOptional()
  @IsEnum(['all', 'draft', 'sent', 'scheduled'])
  tab?: string;

  @ApiPropertyOptional({
    enum: ['all', 'brands', 'creators'],
    description: 'Filter by audience',
  })
  @IsOptional()
  @IsEnum(['all', 'brands', 'creators'])
  audience?: string;

  @ApiPropertyOptional({ description: 'Search term for title or message' })
  @IsOptional()
  @IsString()
  q?: string;
}
