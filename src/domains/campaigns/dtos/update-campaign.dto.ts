import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsUUID,
  IsArray,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCampaignDto {
  @ApiPropertyOptional({
    description: 'The current step in the campaign creation wizard (1 to 5)',
    example: 2,
  })
  @Transform(({ value }: { value: unknown }): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  currentStep?: number;

  @ApiPropertyOptional({
    description: 'Campaign title',
    example: 'Summer Style Collection 2026',
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Campaign goal',
    example: 'Amplify Content',
    enum: ['Create Content', 'Amplify Content'],
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsString()
  @IsIn(['Create Content', 'Amplify Content'])
  @IsOptional()
  goal?: string;

  @ApiPropertyOptional({
    description: 'Total campaign budget in standard currency unit',
    example: 3000000,
  })
  @Transform(({ value }: { value: unknown }): number | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  totalBudget?: number;

  @ApiPropertyOptional({
    description: 'ID of the creator category targeted',
    example: 'b5c03d87-18dd-419b-a4db-d06670c485ad',
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsUUID(4)
  @IsOptional()
  creatorCategoryId?: string;

  @ApiPropertyOptional({
    description: 'IDs of the preferred social media platforms',
    example: ['b5c03d87-18dd-419b-a4db-d06670c485ad'],
    type: [String],
  })
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((v: unknown) => String(v).trim());
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((v: unknown) => String(v).trim());
        }
      } catch {
        // ignore JSON parse error
      }
      if (trimmed.includes(',')) {
        return trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [trimmed];
    }
    return [];
  })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  preferredPlatformIds?: string[];

  @ApiPropertyOptional({
    description: 'List of deliverables required',
    example: ['1x Instagram Carousel Post', '3x Instagram Stories'],
    type: [String],
  })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore invalid JSON
      }
      return [trimmed];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deliverables?: string[];

  @ApiPropertyOptional({
    description: 'List of directions or creative guidelines',
    example: ['Dramatic before and after revealing the outfit'],
    type: [String],
  })
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore invalid JSON
      }
      return [trimmed];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  contentDirection?: string[];

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
  @IsObject()
  @IsOptional()
  contentGuidelines?: { dos: string[]; donts: string[] };

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
    description: 'Usage rights description',
    example: 'Creators grant Zare Africa permission to repost and use content.',
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsString()
  @IsOptional()
  usageRights?: string;

  @ApiPropertyOptional({
    description: 'Success looks like description',
    example: 'We are looking for authentic, visually appealing content.',
  })
  @Transform(({ value }: { value: unknown }): string | undefined => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  })
  @IsString()
  @IsOptional()
  successLooksLike?: string;

  @ApiPropertyOptional({
    description: 'Campaign cover image file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  coverImage?: any;
}
