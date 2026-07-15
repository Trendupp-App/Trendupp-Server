import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsIn, IsString } from 'class-validator';

export class ReviewApplicationDto {
  @ApiProperty({
    description: 'The review decision status for the campaign application',
    example: 'accepted',
    enum: ['accepted', 'rejected'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['accepted', 'rejected'], {
    message: 'status must be either accepted or rejected',
  })
  status: string;
}
