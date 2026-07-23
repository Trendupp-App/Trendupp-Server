import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token for this device install' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;

  @ApiProperty({ enum: ['android', 'ios'] })
  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

export class UnregisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token to remove' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
