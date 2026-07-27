import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RespondToCommentDto {
  @ApiProperty({
    description: 'The response to the creator comment/question',
    example: 'Yes, the trial period is 14 days.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'response must be at least 5 characters long' })
  response: string;
}
