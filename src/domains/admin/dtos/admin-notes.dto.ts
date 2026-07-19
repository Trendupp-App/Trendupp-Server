import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAdminNoteDto {
  @ApiProperty({
    example: 'Flagged as top performer. Recommend for premium campaigns.',
    description: 'Internal admin note content',
  })
  @IsNotEmpty()
  @IsString()
  note: string;
}

export class UpdateAdminNoteDto {
  @ApiPropertyOptional({
    example: 'Verified bank details manually. All good.',
    description: 'Updated internal note content',
  })
  @IsNotEmpty()
  @IsString()
  note: string;
}

export class AdminAuthorDto {
  @ApiProperty({ example: 'admin-uuid-1' })
  id: string;

  @ApiProperty({ example: 'Admin Jane' })
  name: string;

  @ApiProperty({ example: 'https://...', nullable: true })
  avatarUrl: string | null;
}

export class AdminNoteResponseDto {
  @ApiProperty({ example: 'note-uuid-1' })
  id: string;

  @ApiProperty({ example: 'Flagged as top performer. Recommend for premium campaigns.' })
  note: string;

  @ApiProperty({ type: AdminAuthorDto })
  admin: AdminAuthorDto;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-01T10:00:00.000Z' })
  updatedAt: Date;
}
