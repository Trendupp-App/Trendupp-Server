import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  IsUUID,
  IsArray,
  IsDateString,
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

  @ApiPropertyOptional({
    description: 'Campaign brief detailing goals and directions',
    example: 'A brief description of our campaign goals.',
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsString()
  @IsOptional()
  campaignBrief?: string;

  @ApiPropertyOptional({
    description: 'Content guidelines containing dos and donts lists',
    example: { dos: ['use natural lighting'], donts: ['no logo displays'] },
  })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        // ignore invalid JSON
      }
    }
    return value;
  })
  @IsOptional()
  contentGuidelines?: { dos: string[]; donts: string[] };

  @ApiProperty({
    description: 'Timeline date for the campaign (ISO string)',
    example: '2026-07-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsNotEmpty()
  timeline: string;

  @ApiProperty({
    description: 'ID of the targeted creator niche',
    example: 'a00d1390-63d3-4a5e-8f07-b10f837fb5ad',
  })
  @IsUUID(4)
  @IsNotEmpty()
  creatorNicheId: string;

  @ApiPropertyOptional({
    description: 'Campaign cover image file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  coverImage?: any;
}
