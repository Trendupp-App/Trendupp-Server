import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Campaign title',
    example: 'Summer Style Collection 2025',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Campaign goal',
    example: 'Create Content',
    enum: ['Create Content', 'Amplify Content'],
  })
  @IsString()
  @IsIn(['Create Content', 'Amplify Content'])
  goal: string;

  @ApiProperty({
    description: 'Total campaign budget in standard currency unit (e.g. 3000000 for ₦3M)',
    example: 3000000,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  totalBudget: number;

  @ApiProperty({
    description: 'Payment estimate range per creator as a string (e.g. "80,000 - 150,000")',
    example: '80,000 - 150,000',
  })
  @IsString()
  @IsNotEmpty()
  paymentPerCreator: string;

  @ApiProperty({
    description: 'ID of the creator category targeted',
    example: 'b5c03d87-18dd-419b-a4db-d06670c485ad',
  })
  @IsUUID(4)
  @IsNotEmpty()
  creatorCategoryId: string;

  @ApiProperty({
    description: 'IDs of the preferred social media platforms',
    example: ['b5c03d87-18dd-419b-a4db-d06670c485ad'],
    type: [String],
  })
  @Transform(({ value }: { value: unknown }): string[] => {
    if (Array.isArray(value)) {
      return value.map((v: unknown) => String(v).trim());
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // 1. Try JSON-encoded array  e.g. '["uuid1","uuid2"]'
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((v: unknown) => String(v).trim());
        }
      } catch {
        // not JSON — continue
      }
      // 2. Try comma-separated  e.g. 'uuid1,uuid2'
      if (trimmed.includes(',')) {
        return trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // 3. Single UUID string
      return [trimmed];
    }
    return [];
  })
  @IsArray()
  @IsUUID(4, { each: true })
  preferredPlatformIds: string[];

  @ApiProperty({
    description: 'Type of content required',
    example: 'Video',
    enum: ['Video', 'Carousel', 'Reel', 'Tweet', 'Image'],
  })
  @IsString()
  @IsIn(['Video', 'Carousel', 'Reel', 'Tweet', 'Image'])
  contentType: string;

  @ApiProperty({
    description: 'Campaign timeline in days (10-15 days recommended by PRD)',
    example: 15,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(90)
  duration: number;

  @ApiPropertyOptional({
    description: 'Content duration constraint per creator (e.g. "30secs - 1min")',
    example: '30secs - 1min',
  })
  @IsString()
  @IsOptional()
  contentDuration?: string;

  @ApiPropertyOptional({
    description: 'Content guidelines written by the brand (e.g. "Creator must not wear red")',
    example: 'Creator must not show nudity in content.',
  })
  @IsString()
  @IsOptional()
  contentGuidelines?: string;

  @ApiPropertyOptional({
    description:
      'Campaign rules written by Trendupp (e.g. "Brands cannot use content after 6 months")',
    example: 'Brands cannot use creator content after 6 months.',
  })
  @IsString()
  @IsOptional()
  campaignRules?: string;

  @ApiPropertyOptional({
    description: 'Campaign cover image file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  coverImage?: any;
}
