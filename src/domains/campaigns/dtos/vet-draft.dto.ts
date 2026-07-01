import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class VetDraftDto {
  @ApiProperty({
    description: 'Vetting decision on the draft content',
    enum: ['approved', 'request_revision'],
    example: 'approved',
  })
  @IsIn(['approved', 'request_revision'], {
    message: 'decision must be either approved or request_revision',
  })
  @IsString()
  @IsNotEmpty()
  decision: 'approved' | 'request_revision';

  @ApiPropertyOptional({
    description: 'Feedback for the creator, required if requesting a revision',
    example: 'Please adjust the lighting and mention the brand in the first 3 seconds.',
  })
  @IsString()
  @IsOptional()
  brandFeedback?: string;
}
