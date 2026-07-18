import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePortfolioItemDto {
  @ApiProperty({ description: 'Title of the portfolio item' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'URL or text link to the work (not validated)' })
  @IsOptional()
  @IsString()
  link?: string;
}
