import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class AdminInviteDto {
  @ApiPropertyOptional({ example: 'Adaeze Okonkwo', description: 'Full Name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Adaeze', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Okonkwo', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'sarah@trendupp.com', description: 'Admin email' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;

  @ApiProperty({
    example: 'finance_admin',
    enum: ['super_admin', 'finance_admin', 'moderator', 'support_agent'],
    description: 'Assigned admin role',
  })
  @IsString()
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(['super_admin', 'finance_admin', 'moderator', 'support_agent'], {
    message: 'Role must be one of: super_admin, finance_admin, moderator, support_agent',
  })
  role: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
