import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDisputeDto {
  @ApiProperty({
    description: 'Reason the dispute is being declined (shown to the parties who were notified)',
    example: 'No evidence of a breach — the campaign terms were met.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
