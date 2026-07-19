import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AdminNote } from '../entities/admin-note.entity';
import { User } from '../../users/entities/user.entity';
import {
  CreateAdminNoteDto,
  UpdateAdminNoteDto,
  AdminNoteResponseDto,
} from '../dtos/admin-notes.dto';

@Injectable()
export class AdminNotesService {
  constructor(
    @InjectModel(AdminNote)
    private readonly adminNoteModel: typeof AdminNote,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  async getNotesForUser(targetUserId: string): Promise<AdminNoteResponseDto[]> {
    const notes = await this.adminNoteModel.findAll({
      where: { targetUserId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
        },
      ],
    });

    return notes.map((n) => this.formatNoteResponse(n));
  }

  async createNote(
    adminId: string,
    targetUserId: string,
    dto: CreateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    const targetUser = await this.userModel.findByPk(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Creator not found');
    }

    const noteRecord = await this.adminNoteModel.create({
      targetUserId,
      adminId,
      note: dto.note.trim(),
    } as unknown as AdminNote);

    const populatedNote = await this.adminNoteModel.findByPk(noteRecord.id, {
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
        },
      ],
    });

    return this.formatNoteResponse(populatedNote || noteRecord);
  }

  async updateNote(
    adminId: string,
    noteId: string,
    dto: UpdateAdminNoteDto,
  ): Promise<AdminNoteResponseDto> {
    const noteRecord = await this.adminNoteModel.findByPk(noteId, {
      include: [
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'firstName', 'lastName', 'avatarUrl'],
        },
      ],
    });

    if (!noteRecord) {
      throw new NotFoundException('Internal note not found');
    }

    if (noteRecord.adminId !== adminId) {
      throw new ForbiddenException('You can only edit your own internal notes');
    }

    noteRecord.note = dto.note.trim();
    await noteRecord.save();

    return this.formatNoteResponse(noteRecord);
  }

  async deleteNote(adminId: string, noteId: string): Promise<{ success: boolean }> {
    const noteRecord = await this.adminNoteModel.findByPk(noteId);
    if (!noteRecord) {
      throw new NotFoundException('Internal note not found');
    }

    if (noteRecord.adminId !== adminId) {
      throw new ForbiddenException('You can only delete your own internal notes');
    }

    await noteRecord.destroy();
    return { success: true };
  }

  private formatNoteResponse(noteRecord: AdminNote): AdminNoteResponseDto {
    const adminUser = noteRecord.admin;
    const adminName = adminUser
      ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Admin'
      : 'Admin';

    return {
      id: noteRecord.id,
      note: noteRecord.note,
      admin: {
        id: noteRecord.adminId,
        name: adminName,
        avatarUrl: adminUser?.avatarUrl || null,
      },
      createdAt: noteRecord.createdAt,
      updatedAt: noteRecord.updatedAt,
    };
  }
}
