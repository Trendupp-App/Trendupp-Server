import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class MockVaPaymentDto {
  @ApiProperty({
    description:
      'Payment amount. Interpreted in Naira by default (e.g. 3483750). Set isKobo=true if passing kobo.',
    example: 3483750,
  })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description:
      'Set to true if amount is already in kobo (fractional units). Defaults to false (interprets as Naira).',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isKobo?: boolean;

  @ApiProperty({
    description: 'Providus Bank virtual account number shown on Startbutton checkout',
    example: '1000196341',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    description: 'The Startbutton transaction reference (e.g. TRX-campaignId-...)',
    example: 'TRX-f9f57bb5-aef5-4c6b-a105-d91cc20ee062-1792310166017',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;
}
