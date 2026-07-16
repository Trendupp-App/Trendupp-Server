import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSocialsDto {
  @ApiPropertyOptional({
    description: 'Instagram handle name',
    example: 'my_insta',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  instagramUsername?: string | null;

  @ApiPropertyOptional({ description: 'Instagram followers count', example: 12000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  instagramFollowers?: number;

  @ApiPropertyOptional({ description: 'TikTok handle name', example: 'my_tiktok', nullable: true })
  @IsString()
  @IsOptional()
  tiktokUsername?: string | null;

  @ApiPropertyOptional({ description: 'TikTok followers count', example: 50000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  tiktokFollowers?: number;

  @ApiPropertyOptional({
    description: 'YouTube channel handle or name',
    example: 'my_channel',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  youtubeUsername?: string | null;

  @ApiPropertyOptional({ description: 'YouTube subscribers count', example: 8500 })
  @IsInt()
  @Min(0)
  @IsOptional()
  youtubeFollowers?: number;

  @ApiPropertyOptional({
    description: 'X / Twitter handle name',
    example: 'my_twitter',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  twitterUsername?: string | null;

  @ApiPropertyOptional({ description: 'X / Twitter followers count', example: 3400 })
  @IsInt()
  @Min(0)
  @IsOptional()
  twitterFollowers?: number;
}
