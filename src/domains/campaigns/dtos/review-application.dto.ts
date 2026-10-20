import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsIn, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @ApiProperty({
    description: 'The review decision status for the campaign application',
    example: 'selected',
    enum: ['selected', 'accepted', 'rejected', 'pending'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['selected', 'accepted', 'rejected', 'pending'], {
    message: 'status must be selected, accepted, rejected, or pending',
  })
  status: string;
}
