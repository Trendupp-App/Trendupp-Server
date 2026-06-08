import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class SetNichesDto {
  @ApiProperty({
    description: 'Array of selected niche IDs',
    example: ['c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44'],
    type: [String],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @IsNotEmpty()
  nicheIds: string[];
}
