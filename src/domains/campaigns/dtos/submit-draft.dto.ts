import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl, IsString } from 'class-validator';

export class SubmitDraftDto {
  @ApiProperty({
    description: 'The URL to the drafted content (e.g. Google Drive link, Figma link)',
    example: 'https://drive.google.com/file/d/amara-summer-style-reel',
  })
  @IsUrl({}, { message: 'draftLink must be a valid URL' })
  @IsString()
  @IsNotEmpty()
  draftLink: string;
}
