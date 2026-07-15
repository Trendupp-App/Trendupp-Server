import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ValidateSelectionDto {
  @ApiProperty({
    description: 'Array of creator application IDs to validate budget availability for',
    example: ['app-uuid-1', 'app-uuid-2'],
  })
  @IsArray()
  @IsString({ each: true })
  applicationIds: string[];
}
