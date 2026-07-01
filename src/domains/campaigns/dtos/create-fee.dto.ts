import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsIn, Min } from 'class-validator';

export class CreateFeeDto {
  @ApiProperty({
    description: 'Name of the fee/charge',
    example: 'Service Charge',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Type of charge: percentage or flat',
    example: 'percentage',
    enum: ['percentage', 'flat'],
  })
  @IsString()
  @IsIn(['percentage', 'flat'])
  type: string;

  @ApiProperty({
    description: 'The rate (e.g. 0.05 for 5%) or flat value',
    example: 0.05,
  })
  @IsNumber()
  @Min(0)
  value: number;
}
