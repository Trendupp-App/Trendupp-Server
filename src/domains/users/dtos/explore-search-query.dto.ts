import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../../shared/dtos/pagination.dto';

export class ExploreSearchQueryDto extends PaginationDto {
  @ApiProperty({
    description: 'Search query string matching campaigns (title) and users (names/usernames)',
    example: 'Fashion',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  q: string;
}
