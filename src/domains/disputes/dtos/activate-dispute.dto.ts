import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ActivateDisputeDto {
  @ApiPropertyOptional({
    description: 'The UUID of a finance admin to add to the dispute chat',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsUUID()
  @IsOptional()
  financeAdminId?: string;
}
