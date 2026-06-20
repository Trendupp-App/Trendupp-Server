import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePersonalInfoDto {
  @ApiPropertyOptional({ description: 'User first name', example: 'alexander' })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  firstName?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'chisom' })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  lastName?: string;

  @ApiPropertyOptional({ description: 'Unique username', example: 'alexsafor' })
  @IsString()
  @Length(3, 30)
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  username?: string;

  @ApiPropertyOptional({ description: 'User email address', example: 'alex@example.com' })
  @IsEmail()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  email?: string;

  @ApiPropertyOptional({
    description: 'Bio information',
    example: 'Fashion and lifestyle creator.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Nationality ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  nationalityId?: string | null;

  @ApiPropertyOptional({
    description: 'Country of Residency ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  countryId?: string | null;

  @ApiPropertyOptional({
    description: 'State ID',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  stateId?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile picture / avatar (JPEG, PNG, WebP up to 5MB)',
  })
  @IsOptional()
  @Transform(({ value }): unknown => (value === '' ? undefined : value))
  avatar?: any;
}
