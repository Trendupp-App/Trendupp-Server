import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { UsersService } from '../../users/services/users.service';
import { OtpService } from '../../auth/services/otp.service';
import { EmailService } from '../../../integration/email/email.service';
import { AuditLogService } from './audit-log.service';
import { AdminInviteDto } from '../dtos/admin-invite.dto';
import { UpdateAdminProfileDto } from '../dtos/update-admin-profile.dto';
import { QueryAdminUsersDto } from '../dtos/query-admin-users.dto';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async inviteAdmin(
    callerId: string,
    dto: AdminInviteDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; admin: Partial<User> }> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const role = await this.roleModel.findOne({ where: { name: dto.role } });
    if (!role) {
      throw new NotFoundException(`Role '${dto.role}' does not exist.`);
    }

    // Generate random temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex') + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const newAdmin = await this.userModel.create({
      email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
      isEmailVerified: true,
      acceptedTerms: true,
    } as any);

    // Generate OTP code for initial password setup / verification
    const otpRecord = await this.otpService.generateOtp(email, 'password-reset');

    // Send invitation email via EmailService
    try {
      await this.emailService.sendAdminInvitationEmail(
        email,
        `${dto.firstName} ${dto.lastName}`.trim(),
        role.displayName || role.name,
        otpRecord.code,
      );
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${email}: ${(err as Error).message}`);
    }

    // Audit logs
    await this.auditLogService.log({
      adminId: callerId,
      action: 'ADMIN_CREATED',
      targetUserId: newAdmin.id,
      ipAddress,
      userAgent,
      details: {
        email: newAdmin.email,
        assignedRole: role.name,
      },
    });

    return {
      message: `Admin user invited successfully. Activation code: ${otpRecord.code}`,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        role: role.name as unknown as Role,
        isActive: newAdmin.isActive,
      },
    };
  }

  async findAllAdmins(query: QueryAdminUsersDto): Promise<PaginatedResult<User>> {
    const { q, role, isActive, page = 1, limit = 20 } = query;
    const where: Record<string | symbol, unknown> = {};

    // Filter by admin roles (owner, superadmin, finance_admin, moderator, support_agent)
    const adminRoles = await this.roleModel.findAll({
      where: {
        name: {
          [Op.in]: ['owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent', 'admin'],
        },
      },
    });
    const adminRoleIds = adminRoles.map((r: Role) => r.id);

    if (role) {
      const selectedRole = adminRoles.find((r) => r.name === role);
      if (selectedRole) {
        where.roleId = selectedRole.id;
      } else {
        where.roleId = null; // force empty result if invalid role passed
      }
    } else {
      where.roleId = { [Op.in]: adminRoleIds };
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (q) {
      const pattern = `%${q}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: pattern } },
        { lastName: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
      ];
    }

    return paginate(
      this.userModel,
      {
        where,
        include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'displayName'] }],
        order: [['createdAt', 'DESC']],
      },
      { page, limit },
    );
  }

  async findAdminById(id: string): Promise<User> {
    const admin = await this.userModel.findByPk(id, {
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'displayName'] }],
    });
    if (!admin) {
      throw new NotFoundException('Admin user not found.');
    }
    return admin;
  }

  async updateAdmin(
    callerId: string,
    targetId: string,
    dto: UpdateAdminProfileDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const targetAdmin = await this.findAdminById(targetId);
    const targetRoleName =
      targetAdmin.role?.name || (typeof targetAdmin.role === 'string' ? targetAdmin.role : '');

    // Prevent modifying owner account unless caller is owner
    if (targetRoleName === 'owner' && callerId !== targetId) {
      throw new ForbiddenException('The owner account cannot be modified by other administrators.');
    }

    const updates: Partial<User> = {};
    if (dto.firstName) updates.firstName = dto.firstName;
    if (dto.lastName) updates.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) updates.phoneNumber = dto.phoneNumber;

    let roleChanged = false;
    const oldRole = targetRoleName;
    let newRole = targetRoleName;

    if (dto.role && dto.role !== targetRoleName) {
      if (targetRoleName === 'owner') {
        throw new ForbiddenException('The owner role cannot be changed.');
      }
      const roleRecord = await this.roleModel.findOne({ where: { name: dto.role } });
      if (!roleRecord) {
        throw new NotFoundException(`Role '${dto.role}' does not exist.`);
      }
      updates.roleId = roleRecord.id;
      roleChanged = true;
      newRole = roleRecord.name;
    }

    await targetAdmin.update(updates);
    const updated = await this.findAdminById(targetId);

    await this.auditLogService.log({
      adminId: callerId,
      action: roleChanged ? 'ROLE_UPDATED' : 'ADMIN_UPDATED',
      targetUserId: targetId,
      ipAddress,
      userAgent,
      details: roleChanged ? { oldRole, newRole } : { updatedFields: Object.keys(updates) },
    });

    return updated;
  }

  async suspendAdmin(
    callerId: string,
    targetId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const targetAdmin = await this.findAdminById(targetId);
    const targetRoleName =
      targetAdmin.role?.name || (typeof targetAdmin.role === 'string' ? targetAdmin.role : '');

    if (targetRoleName === 'owner') {
      throw new ForbiddenException('The owner account cannot be suspended.');
    }

    if (callerId === targetId) {
      throw new BadRequestException('You cannot suspend your own administrator account.');
    }

    await targetAdmin.update({ isActive: false });

    await this.auditLogService.log({
      adminId: callerId,
      action: 'ADMIN_SUSPENDED',
      targetUserId: targetId,
      ipAddress,
      userAgent,
      details: { email: targetAdmin.email },
    });

    return { message: `Administrator ${targetAdmin.email} has been suspended.` };
  }

  async reactivateAdmin(
    callerId: string,
    targetId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const targetAdmin = await this.findAdminById(targetId);

    await targetAdmin.update({ isActive: true });

    await this.auditLogService.log({
      adminId: callerId,
      action: 'ADMIN_REACTIVATED',
      targetUserId: targetId,
      ipAddress,
      userAgent,
      details: { email: targetAdmin.email },
    });

    return { message: `Administrator ${targetAdmin.email} has been reactivated.` };
  }

  async deleteAdmin(
    callerId: string,
    targetId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const targetAdmin = await this.findAdminById(targetId);
    const targetRoleName =
      targetAdmin.role?.name || (typeof targetAdmin.role === 'string' ? targetAdmin.role : '');

    if (targetRoleName === 'owner') {
      throw new ForbiddenException('The owner account cannot be deleted.');
    }

    if (callerId === targetId) {
      throw new BadRequestException('You cannot delete your own administrator account.');
    }

    const email = targetAdmin.email;
    await targetAdmin.destroy();

    await this.auditLogService.log({
      adminId: callerId,
      action: 'ADMIN_DELETED',
      targetUserId: targetId,
      ipAddress,
      userAgent,
      details: { deletedEmail: email },
    });

    return { message: `Administrator account ${email} has been permanently deleted.` };
  }
}
