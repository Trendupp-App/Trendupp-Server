import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { paginate, PaginatedResult } from '../../../shared/utils/pagination.utils';

export interface CreateAuditLogInput {
  adminId: string;
  action: string;
  targetUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export interface QueryAuditLogsInput {
  action?: string;
  adminId?: string;
  targetUserId?: string;
  q?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,
  ) {}

  async createLog(input: CreateAuditLogInput): Promise<AuditLog> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.auditLogModel.create(input as any);
  }

  async findAll(query: QueryAuditLogsInput): Promise<PaginatedResult<AuditLog>> {
    const { action, adminId, targetUserId, q, startDate, endDate, page = 1, limit = 20 } = query;
    const where: Record<string | symbol, unknown> = {};

    // Exact action filter wins over the free-text search when both are sent.
    if (action) {
      where.action = action;
    } else if (q) {
      where.action = { [Op.iLike]: `%${q}%` };
    }
    if (adminId) {
      where.adminId = adminId;
    }
    if (targetUserId) {
      where.targetUserId = targetUserId;
    }
    if (startDate || endDate) {
      const dateFilter: Record<symbol, Date> = {};
      if (startDate) {
        dateFilter[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        dateFilter[Op.lte] = new Date(endDate);
      }
      where.createdAt = dateFilter;
    }

    return paginate(
      this.auditLogModel,
      {
        where,
        include: [
          {
            model: User,
            as: 'admin',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [{ model: Role, as: 'role', attributes: ['name', 'displayName'] }],
          },
          {
            model: User,
            as: 'targetUser',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
        order: [['createdAt', 'DESC']],
      },
      { page, limit },
    );
  }

  /** Distinct action names ever recorded — drives the filter dropdown. */
  async listActions(): Promise<string[]> {
    const rows = (await this.auditLogModel.findAll({
      attributes: [
        [
          this.auditLogModel.sequelize!.fn('DISTINCT', this.auditLogModel.sequelize!.col('action')),
          'action',
        ],
      ],
      order: [['action', 'ASC']],
      raw: true,
    })) as unknown as { action: string }[];
    return rows.map((r) => r.action);
  }
}
