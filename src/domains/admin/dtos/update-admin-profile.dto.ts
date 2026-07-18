import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateAdminProfileDto {
  @ApiPropertyOptional({ example: 'Sarah', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Connor', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'moderator',
    enum: ['super_admin', 'finance_admin', 'moderator', 'support_agent'],
    description: 'Assigned role (Owner only)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['super_admin', 'finance_admin', 'moderator', 'support_agent'], {
    message: 'Role must be one of: super_admin, finance_admin, moderator, support_agent',
  })
  role?: string;
}
