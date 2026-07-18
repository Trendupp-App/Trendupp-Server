import { Injectable, Logger } from '@nestjs/common';
import {
  AuditLogRepository,
  CreateAuditLogInput,
  QueryAuditLogsInput,
} from '../repository/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';
import { PaginatedResult } from '../../../shared/utils/pagination.utils';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async log(input: CreateAuditLogInput): Promise<AuditLog | null> {
    try {
      const entry = await this.auditLogRepository.createLog(input);
      this.logger.log(`Audit log recorded: [${input.action}] by admin [${input.adminId}]`);
      return entry;
    } catch (err) {
      this.logger.error(`Failed to record audit log: ${(err as Error).message}`);
      return null;
    }
  }

  async findAll(query: QueryAuditLogsInput): Promise<PaginatedResult<AuditLog>> {
    return this.auditLogRepository.findAll(query);
  }
}
