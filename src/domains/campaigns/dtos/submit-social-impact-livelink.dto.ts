import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class SubmitSocialImpactLiveLinkDto {
  @ApiProperty({
    example: 'https://instagram.com/p/C_123456789/',
    description: 'Direct live link to the published Social Impact content',
  })
  @IsNotEmpty()
  @IsUrl()
  liveLink: string;
}
