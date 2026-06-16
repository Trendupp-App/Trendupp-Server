import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateNichesDto {
  @ApiProperty({
    description: 'Array of Niche UUIDs to associate with the user',
    example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  nicheIds: string[];
}
