import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

const DISPUTE_ACTIONS = [
  'release_to_creator',
  'refund_to_brand',
  'split',
  'allow_content_submission',
  'allow_content_review',
  'allow_revised_submission',
  'allow_revised_review',
] as const;

export type DisputeAction = (typeof DISPUTE_ACTIONS)[number];

export class ResolveDisputeDto {
  @ApiProperty({
    description: 'The action to take on the dispute or escrowed funds',
    enum: DISPUTE_ACTIONS,
    example: 'allow_content_submission',
  })
  @IsEnum(DISPUTE_ACTIONS)
  @IsNotEmpty()
  action: DisputeAction;

  @ApiProperty({
    description: 'Arbitration notes/justification for the resolution',
    example: 'Escrow released. Creator proved submission and links are verified.',
  })
  @IsString()
  @IsNotEmpty()
  resolutionNotes: string;

  @ApiPropertyOptional({
    description: 'Amount allocated to creator if action is split',
    example: 50000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  splitCreatorAmount?: number;
}
