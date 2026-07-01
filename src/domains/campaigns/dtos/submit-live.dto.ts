import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class SubmitLiveDto {
  @ApiProperty({
    description: 'Map of platform names to live link URLs',
    example: { instagram: 'https://instagram.com/p/amara-summer-style-reel' },
  })
  @IsObject()
  @IsNotEmpty()
  liveLink: Record<string, string>;
}
