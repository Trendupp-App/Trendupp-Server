import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl, IsString } from 'class-validator';

export class SubmitLiveDto {
  @ApiProperty({
    description: 'The actual published post link on the selected platform',
    example: 'https://instagram.com/p/amara-summer-style-reel',
  })
  @IsUrl({}, { message: 'liveLink must be a valid URL' })
  @IsString()
  @IsNotEmpty()
  liveLink: string;
}
