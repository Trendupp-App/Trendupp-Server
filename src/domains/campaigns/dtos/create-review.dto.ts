import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsUUID, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'The campaign ID this review is for' })
  @IsUUID('4')
  campaignId: string;

  @ApiProperty({ description: 'The creator user ID who is being reviewed' })
  @IsUUID('4')
  creatorId: string;

  @ApiProperty({ description: 'The star rating from 1 to 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  starRating: number;

  @ApiPropertyOptional({ description: 'Optional written review comments', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
