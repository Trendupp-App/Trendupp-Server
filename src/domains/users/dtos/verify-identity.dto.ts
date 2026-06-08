import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class VerifyIdentityDto {
  @ApiProperty({
    description: 'The URL of the uploaded selfie video',
    example: 'https://trendupp-assets.s3.amazonaws.com/videos/selfie.mp4',
  })
  @IsUrl()
  @IsNotEmpty()
  verificationVideoUrl: string;
}
