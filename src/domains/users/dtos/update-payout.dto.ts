import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdatePayoutDto {
  @ApiProperty({
    description: 'Bank code from Startbutton',
    example: '044',
  })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({
    description: 'Name of the bank from Startbutton',
    example: 'Access Bank',
  })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '4775692892',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  bankAccountNumber: string;

  @ApiPropertyOptional({
    description: 'Verified bank account holder name — auto-populated from Startbutton verification response. Not required from the frontend.',
    example: 'ALEX OKAFOR',
  })
  @IsOptional()
  @IsString()
  bankAccountName?: string;
}
