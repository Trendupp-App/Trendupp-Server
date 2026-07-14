import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsUUID } from 'class-validator';

export class ReviewApplicationsBatchDto {
  @ApiProperty({
    description: 'Array of application IDs to review',
    example: ['b5c03d87-18dd-419b-a4db-d06670c485ad'],
    type: [String],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  applicationIds: string[];

  @ApiProperty({
    description: 'The review status to apply to all selected applications',
    example: 'accepted',
    enum: ['accepted', 'rejected'],
  })
  @IsIn(['accepted', 'rejected'])
  status: string;
}
