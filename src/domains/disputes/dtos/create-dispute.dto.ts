import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'The UUID of the campaign under dispute',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty({
    description: 'The reason for escalating the dispute',
    example: 'Creator submitted empty links and has not responded for 3 days.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'The UUID of the creator involved (required if escalated by brand)',
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @IsUUID()
  @IsOptional()
  creatorId?: string;
}
