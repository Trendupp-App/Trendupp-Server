import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({
    description: 'The action to take on the dispute or escrowed funds',
    enum: ['release_to_creator', 'refund_to_brand', 'split', 'extend_days'],
    example: 'extend_days',
  })
  @IsEnum(['release_to_creator', 'refund_to_brand', 'split', 'extend_days'])
  @IsNotEmpty()
  action: 'release_to_creator' | 'refund_to_brand' | 'split' | 'extend_days';

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
