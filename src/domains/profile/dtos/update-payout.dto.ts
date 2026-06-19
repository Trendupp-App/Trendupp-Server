import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, IsUUID } from 'class-validator';

export class UpdatePayoutDto {
  @ApiProperty({
    description: 'ID of the bank (UUID)',
    example: 'a63b0a70-761e-42c2-8b5e-ca92c687e1a3',
  })
  @IsUUID('4')
  @IsNotEmpty()
  bankId: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '4775692892',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  bankAccountNumber: string;

  @ApiProperty({
    description: 'Verified bank account holder name',
    example: 'Alex Okafor',
  })
  @IsString()
  @IsNotEmpty()
  bankAccountName: string;
}
