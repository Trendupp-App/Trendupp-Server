import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSocialsDto {
  @ApiPropertyOptional({ description: 'Instagram handle name', example: 'my_insta' })
  @IsString()
  @IsOptional()
  instagramUsername?: string;

  @ApiPropertyOptional({ description: 'Instagram followers count', example: 12000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  instagramFollowers?: number;

  @ApiPropertyOptional({ description: 'TikTok handle name', example: 'my_tiktok' })
  @IsString()
  @IsOptional()
  tiktokUsername?: string;

  @ApiPropertyOptional({ description: 'TikTok followers count', example: 50000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  tiktokFollowers?: number;

  @ApiPropertyOptional({ description: 'YouTube channel handle or name', example: 'my_channel' })
  @IsString()
  @IsOptional()
  youtubeUsername?: string;

  @ApiPropertyOptional({ description: 'YouTube subscribers count', example: 8500 })
  @IsInt()
  @Min(0)
  @IsOptional()
  youtubeFollowers?: number;

  @ApiPropertyOptional({ description: 'X / Twitter handle name', example: 'my_twitter' })
  @IsString()
  @IsOptional()
  twitterUsername?: string;

  @ApiPropertyOptional({ description: 'X / Twitter followers count', example: 3400 })
  @IsInt()
  @Min(0)
  @IsOptional()
  twitterFollowers?: number;
}
