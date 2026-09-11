import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateNewsDto {
  @ApiProperty({ example: 'Platform Update 2.0', description: 'The title of the news article' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'A brief summary of the news', description: 'Optional summary' })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({
    example: '<p>Full content of the news...</p>',
    description: 'The main content of the news',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Cover image file',
  })
  @IsOptional()
  coverImage?: any;

  @ApiProperty({ example: 'Announcement', description: 'Category of the news' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    enum: ['draft', 'published', 'scheduled'],
    default: 'draft',
    description: 'Status of the news',
  })
  @IsEnum(['draft', 'published', 'scheduled'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: '2026-09-15T10:00:00.000Z',
    description:
      'Scheduled publication timestamp (ISO 8601 string, required when status is scheduled)',
  })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether this is a platform update',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: any }) => value === 'true' || value === true)
  isPlatformUpdate?: boolean;

  @ApiPropertyOptional({ example: true, default: false, description: 'Whether this is top news' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }: { value: any }) => value === 'true' || value === true)
  isTopNews?: boolean;

  @ApiPropertyOptional({
    example: 'uuid-of-industry',
    description: 'Optional industry filter for the news',
  })
  @IsUUID()
  @IsOptional()
  industryId?: string;
}
