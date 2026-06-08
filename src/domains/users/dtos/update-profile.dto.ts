import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Unique username selected by user',
    example: 'trendsetter_ojima',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 30)
  username: string;

  @ApiProperty({
    description: 'Nationality ID from the nationalities lookup',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  @IsNotEmpty()
  nationalityId: string;

  @ApiProperty({
    description: 'State ID from the states lookup',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID()
  @IsNotEmpty()
  stateId: string;

  @ApiPropertyOptional({
    description: 'A brief tagline/bio about the user',
    example: 'Exploring lifestyle and fashion trends in Lagos.',
  })
  @IsString()
  @IsOptional()
  bio?: string;
}
