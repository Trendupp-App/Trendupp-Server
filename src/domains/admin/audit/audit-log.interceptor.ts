import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_METADATA_KEY, AuditMeta } from './audit.decorator';

/** Request fields never persisted into audit details. */
const SENSITIVE_KEYS = /password|token|secret|otp|authorization|apikey|api_key/i;

interface AuditableRequest {
  user?: { id?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || depth > 3) {
    // Cap huge strings (e.g. broadcast bodies) — the audit row is a trail, not a copy.
    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}… [truncated]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitize(v, depth + 1);
  }
  return result;
}

/**
 * Writes an audit_logs row for every successful call to a route decorated
 * with @Audit(...). Registered globally (APP_INTERCEPTOR from AdminModule);
 * routes without the decorator are untouched. Logging is fire-and-forget —
 * AuditLogService.log() never throws — so a logging failure can never fail
 * the admin's action.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();

    return next.handle().pipe(
      tap(() => {
        const adminId = request.user?.id;
        if (!adminId) return; // unauthenticated route — nothing to attribute

        const forwardedFor = request.headers['x-forwarded-for'];
        void this.auditLogService.log({
          adminId,
          action: meta.action,
          targetUserId: (meta.targetUserParam && request.params?.[meta.targetUserParam]) || null,
          ipAddress:
            request.ip || (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || null,
          userAgent: (request.headers['user-agent'] as string) || null,
          details: {
            params: sanitize(request.params ?? {}),
            query: sanitize(request.query ?? {}),
            body: sanitize(request.body ?? {}),
          },
        });
      }),
    );
  }
}
