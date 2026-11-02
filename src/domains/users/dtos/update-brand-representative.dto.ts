import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class UpdateBrandRepresentativeDto {
  @ApiProperty({
    description: 'First name of the brand representative',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  repFirstName: string;

  @ApiProperty({
    description: 'Last name of the brand representative',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  repLastName: string;

  @ApiProperty({
    description: 'Work email address of the brand representative',
    example: 'john.doe@company.com',
  })
  @IsEmail()
  @IsNotEmpty()
  repEmail: string;

  @ApiProperty({
    description: 'Phone number of the brand representative',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty()
  repPhone: string;

  @ApiPropertyOptional({
    description: 'Gender of the brand representative',
    example: 'female',
    enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
  })
  @IsEnum(['male', 'female', 'non-binary', 'prefer-not-to-say'])
  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === 'string'
      ? value.trim() === ''
        ? undefined
        : value.trim().toLowerCase()
      : value,
  )
  gender?: string;

  @ApiPropertyOptional({
    description: 'Gender of the brand representative (alias for gender)',
    example: 'female',
    enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'],
  })
  @IsEnum(['male', 'female', 'non-binary', 'prefer-not-to-say'])
  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === 'string'
      ? value.trim() === ''
        ? undefined
        : value.trim().toLowerCase()
      : value,
  )
  repGender?: string;
}
