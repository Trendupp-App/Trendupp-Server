import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdatePayoutDto {
  @ApiProperty({
    description: 'Name of the bank (e.g. Access Bank PLC)',
    example: 'Access Bank PLC',
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

  @ApiProperty({
    description: 'Verified bank account holder name (returned from mobile-side bank lookup)',
    example: 'Alex Okafor',
  })
  @IsString()
  @IsNotEmpty()
  bankAccountName: string;
}
