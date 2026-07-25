import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:meta';

export interface AuditMeta {
  /** SCREAMING_SNAKE action name recorded in audit_logs (filterable). */
  action: string;
  /** Route param holding the affected USER's id (e.g. 'id' on /creators/:id/notes). */
  targetUserParam?: string;
}

/**
 * Marks a mutation route for automatic audit logging (AuditLogInterceptor):
 * on success, one audit_logs row is written with the acting admin, IP,
 * user agent and the sanitized request (params/query/body).
 *
 *   @Patch('campaigns/:id/approve')
 *   @Audit('CAMPAIGN_APPROVED')
 *
 * Services that need richer detail payloads keep calling
 * auditLogService.log() directly — do NOT also decorate those routes,
 * or the action is recorded twice.
 */
export const Audit = (action: string, options: Omit<AuditMeta, 'action'> = {}) =>
  SetMetadata(AUDIT_METADATA_KEY, { action, ...options } satisfies AuditMeta);
