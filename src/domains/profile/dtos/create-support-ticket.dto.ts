import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSupportTicketDto {
  @ApiProperty({
    description: 'The UUID of the issue category',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  issueCategoryId: string;

  @ApiProperty({
    description: 'Brief summary of the issue',
    example: 'Failed bank payout transaction',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  subject: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'My payout request on 15th June remains pending with status code error.',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 1000)
  description: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional file attachment (JPG, PNG, PDF up to 10MB)',
  })
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  attachment?: any;
}
