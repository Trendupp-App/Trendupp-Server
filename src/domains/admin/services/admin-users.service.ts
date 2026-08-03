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
import { NotificationsService } from '../../notifications/services/notifications.service';
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
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Display name for staff-inbox notifications about a team member. */
  private static adminDisplayName(user: { firstName?: string; lastName?: string; email: string }) {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
  }

  /** 7-day TTL used for admin invitation OTPs */
  private readonly INVITE_OTP_EXPIRES_MINUTES = 7 * 24 * 60; // 10 080 minutes

  async inviteAdmin(
    callerId: string,
    dto: AdminInviteDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; code: string; admin: Partial<User> }> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.usersService.findByEmail(email);

    // ── RE-INVITE path ────────────────────────────────────────────────────────
    // If the account already exists we treat this as a resend rather than a
    // conflict, PROVIDED the account belongs to an admin role and the invite
    // OTP (password-reset type) for that email still exists in the DB (i.e.
    // the invited admin has NOT yet set up their password via the invite link).
    if (existingUser) {
      const existingOtp = await this.otpService.findPendingInviteOtp(email);

      if (!existingOtp && existingUser.lastLoginAt) {
        // Account exists and admin has completed initial login → setup fully done
        throw new ConflictException(
          'An account with this email already exists and has been fully set up. ' +
            'If you need to reset their access, use the suspend or delete options.',
        );
      }

      // Wipe old OTP, issue a fresh 7-day one
      const freshOtp = await this.otpService.generateOtp(
        email,
        'password-reset',
        this.INVITE_OTP_EXPIRES_MINUTES,
      );

      const roleName =
        existingUser.role?.name ||
        (typeof existingUser.role === 'string' ? existingUser.role : dto.role);
      const displayName = existingUser.role?.displayName || roleName;

      try {
        await this.emailService.sendAdminInvitationEmail(
          email,
          `${existingUser.firstName} ${existingUser.lastName}`.trim(),
          displayName,
          freshOtp.code,
        );
      } catch (err) {
        this.logger.error(
          `Failed to resend invitation email to ${email}: ${(err as Error).message}`,
        );
      }

      this.logger.log(`Re-invite sent to existing pending admin ${email}`);

      return {
        message: `Invitation resent successfully. A new 7-day activation link has been emailed.`,
        code: freshOtp.code,
        admin: {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          role: existingUser.role,
          isActive: existingUser.isActive,
        },
      };
    }

    // Parse names from dto.fullName if firstName/lastName not provided directly
    let firstName = dto.firstName || '';
    let lastName = dto.lastName || '';
    if (!firstName && !lastName && dto.fullName) {
      const parts = dto.fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    // ── NEW INVITE path ───────────────────────────────────────────────────────
    const role = await this.roleModel.findOne({ where: { name: dto.role } });
    if (!role) {
      throw new NotFoundException(`Role '${dto.role}' does not exist.`);
    }

    // Generate random temporary password (never shared; admin sets their own via invite link)
    const tempPassword = crypto.randomBytes(12).toString('hex') + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const newAdmin = await this.userModel.create({
      email,
      firstName,
      lastName,
      phoneNumber: dto.phoneNumber,
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
      isEmailVerified: true,
      acceptedTerms: true,
    } as any);

    // Generate 7-day OTP for initial password setup
    const otpRecord = await this.otpService.generateOtp(
      email,
      'password-reset',
      this.INVITE_OTP_EXPIRES_MINUTES,
    );

    try {
      await this.emailService.sendAdminInvitationEmail(
        email,
        `${firstName} ${lastName}`.trim(),
        role.displayName || role.name,
        otpRecord.code,
      );
    } catch (err) {
      this.logger.error(`Failed to send invitation email to ${email}: ${(err as Error).message}`);
    }

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

    await this.notificationsService.notify({
      type: 'admin.team_member_invited',
      recipientRole: ['owner', 'super_admin'],
      actorId: callerId,
      data: {
        adminName: AdminUsersService.adminDisplayName(newAdmin),
        roleName: role.displayName || role.name,
      },
    });

    return {
      message: `Admin user invited successfully. A 7-day activation link has been emailed.`,
      code: otpRecord.code,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        role: role,
        isActive: newAdmin.isActive,
      },
    };
  }

  async resendInvite(
    callerId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; code: string; admin: Partial<User> }> {
    const adminUser = await this.userModel.findByPk(id, {
      include: [{ model: Role, as: 'role' }],
    });

    if (!adminUser) {
      throw new NotFoundException(`Sub-admin with ID '${id}' not found.`);
    }

    const roleName =
      adminUser.role?.name || (typeof adminUser.role === 'string' ? adminUser.role : '');
    const isStaff = [
      'owner',
      'super_admin',
      'finance_admin',
      'moderator',
      'support_agent',
    ].includes(roleName);

    if (!isStaff) {
      throw new BadRequestException('Target user is not a sub-admin staff member.');
    }

    if (adminUser.lastLoginAt) {
      throw new ConflictException(
        'This admin user has already completed setup and logged into the platform.',
      );
    }

    // Wipe any existing OTP and issue a fresh 7-day activation OTP link
    const freshOtp = await this.otpService.generateOtp(
      adminUser.email,
      'password-reset',
      this.INVITE_OTP_EXPIRES_MINUTES,
    );

    const displayName = adminUser.role?.displayName || roleName || 'Sub-Admin';

    try {
      await this.emailService.sendAdminInvitationEmail(
        adminUser.email,
        `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Admin User',
        displayName,
        freshOtp.code,
      );
    } catch (err) {
      this.logger.error(
        `Failed to resend invitation email to ${adminUser.email}: ${(err as Error).message}`,
      );
    }

    await this.auditLogService.log({
      adminId: callerId,
      action: 'ADMIN_INVITE_RESENT',
      targetUserId: adminUser.id,
      ipAddress,
      userAgent,
      details: { email: adminUser.email, role: roleName },
    });

    return {
      message: `Invitation resent successfully. A new 7-day activation link has been emailed to ${adminUser.email}.`,
      code: freshOtp.code,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
        isActive: adminUser.isActive,
      },
    };
  }

  async getRoles(): Promise<
    { id: string; name: string; displayName: string; description: string }[]
  > {
    const roles = await this.roleModel.findAll({
      where: {
        name: {
          [Op.in]: ['owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent'],
        },
      },
      order: [['name', 'ASC']],
    });

    const descriptions: Record<string, string> = {
      super_admin: 'Full platform access and management.',
      finance_admin: 'Manages escrow, payouts, and financial reports.',
      moderator: 'Review content, reports, and flags.',
      support_agent: 'Handles disputes, tickets, chat approvals.',
      owner: 'Platform owner with unrestricted system control.',
    };

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName || r.name,
      description: descriptions[r.name] || 'Administrator staff role',
    }));
  }

  async findAllAdmins(
    query: QueryAdminUsersDto,
  ): Promise<PaginatedResult<User> & { metrics: any }> {
    const { q, role, isActive, page = 1, limit = 20 } = query;
    const whereClause: Record<string, unknown> = {};

    // Filter by admin roles (owner, superadmin, finance_admin, moderator, support_agent)
    const adminRoles = await this.roleModel.findAll({
      where: {
        name: {
          [Op.in]: ['owner', 'super_admin', 'finance_admin', 'moderator', 'support_agent'],
        },
      },
    });
    const adminRoleIds = adminRoles.map((r: Role) => r.id);

    if (role) {
      const selectedRole = adminRoles.find((r) => r.name === role);
      if (selectedRole) {
        whereClause.roleId = selectedRole.id;
      } else {
        whereClause.roleId = null; // force empty result if invalid role passed
      }
    } else {
      whereClause.roleId = { [Op.in]: adminRoleIds };
    }

    if (typeof isActive === 'boolean') {
      whereClause.isActive = isActive;
    }

    if (q) {
      const pattern = `%${q}%`;
      Object.assign(whereClause, {
        [Op.or]: [
          { firstName: { [Op.iLike]: pattern } },
          { lastName: { [Op.iLike]: pattern } },
          { email: { [Op.iLike]: pattern } },
        ],
      });
    }

    const allAdmins = await this.userModel.findAll({
      where: { roleId: { [Op.in]: adminRoleIds } },
    });

    let pendingCount = 0;
    let activeCount = 0;
    for (const adm of allAdmins) {
      const pendingOtp = await this.otpService.findPendingInviteOtp(adm.email);
      if (pendingOtp || !adm.lastLoginAt) {
        pendingCount++;
      } else if (adm.isActive) {
        activeCount++;
      }
    }

    const paginated = await paginate(
      this.userModel,
      {
        where: whereClause as never,
        include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'displayName'] }],
        order: [['createdAt', 'DESC']],
      },
      { page, limit },
    );

    // Decorate each admin instance with virtual status field
    for (const adm of paginated.data) {
      const pendingOtp = await this.otpService.findPendingInviteOtp(adm.email);
      const status =
        pendingOtp || !adm.lastLoginAt ? 'Pending Setup' : adm.isActive ? 'Active' : 'Suspended';
      adm.setDataValue('status' as any, status);
      adm.setDataValue('joinedAt' as any, adm.createdAt);
      adm.setDataValue('lastLoginAt' as any, adm.lastLoginAt || null);
    }

    return {
      ...paginated,
      metrics: {
        totalStaff: allAdmins.length,
        active: activeCount,
        pendingSetup: pendingCount,
        rolesAvailable: adminRoles.length,
      },
    };
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

    await this.notificationsService.notify({
      type: 'admin.team_member_suspended',
      recipientRole: ['owner', 'super_admin'],
      actorId: callerId,
      data: { adminName: AdminUsersService.adminDisplayName(targetAdmin) },
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

    await this.notificationsService.notify({
      type: 'admin.team_member_reactivated',
      recipientRole: ['owner', 'super_admin'],
      actorId: callerId,
      data: { adminName: AdminUsersService.adminDisplayName(targetAdmin) },
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
    const deletedName = AdminUsersService.adminDisplayName(targetAdmin);
    await targetAdmin.destroy();

    await this.notificationsService.notify({
      type: 'admin.team_member_removed',
      recipientRole: ['owner', 'super_admin'],
      actorId: callerId,
      data: { adminName: deletedName },
    });

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
