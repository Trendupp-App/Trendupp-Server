import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsUUID,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ApplyCampaignDto {
  @ApiProperty({
    description: 'The creative concept / content idea for the campaign',
    example: 'I will create a morning routine reel showing how I style the summer collection.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'contentIdea must be at least 20 characters long' })
  contentIdea: string;

  @ApiPropertyOptional({
    description: "An optional link to the creator's past work",
    example: 'https://instagram.com/p/example',
  })
  @IsUrl({}, { message: 'pastWorkLink must be a valid URL' })
  @IsString()
  @IsOptional()
  pastWorkLink?: string;

  @ApiProperty({
    description: 'The ID of the primary platform selected',
    example: 'b5c03d87-18dd-419b-a4db-d06670c485ad',
  })
  @IsUUID(4)
  @IsNotEmpty()
  primaryPlatformId: string;

  @ApiPropertyOptional({
    description: 'The ID of the secondary platform selected',
    example: 'd9a8e7d6-c5b4-4a3f-2d1e-0f9e8d7c6b5a',
  })
  @IsUUID(4)
  @IsOptional()
  secondaryPlatformId?: string;

  @ApiProperty({
    description: 'The requested campaign fee in standard currency units',
    example: 150000,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  feeRequest: number;

  @ApiPropertyOptional({
    description: 'Optional comments or questions for the advertiser',
    example: 'How long is the product trial period?',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
