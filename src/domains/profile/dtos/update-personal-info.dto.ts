import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsEmail, Length } from 'class-validator';

export class UpdatePersonalInfoDto {
  @ApiPropertyOptional({ description: 'User first name', example: 'alexander' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'User last name', example: 'chisom' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Unique username', example: 'alexsafor' })
  @IsString()
  @Length(3, 30)
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'User email address', example: 'alex@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Bio information',
    example: 'Fashion and lifestyle creator.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Nationality ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  nationalityId?: string | null;

  @ApiPropertyOptional({
    description: 'Country of Residency ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  countryId?: string | null;

  @ApiPropertyOptional({
    description: 'State ID',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  stateId?: string | null;
}
