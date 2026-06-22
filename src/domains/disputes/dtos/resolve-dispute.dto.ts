import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({
    description: 'The action to take on the escrowed funds',
    enum: ['release_to_creator', 'refund_to_brand', 'split'],
    example: 'release_to_creator',
  })
  @IsEnum(['release_to_creator', 'refund_to_brand', 'split'])
  @IsNotEmpty()
  action: 'release_to_creator' | 'refund_to_brand' | 'split';

  @ApiProperty({
    description: 'Arbitration notes/justification for the resolution',
    example: 'Escrow released. Creator proved submission and links are verified.',
  })
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiPropertyOptional({
    description: 'Amount allocated to creator if action is split',
    example: 50000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  splitCreatorAmount?: number;
}
