/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from '../services/audit-log.service';
import { AuditMeta } from './audit.decorator';

describe('AuditLogInterceptor', () => {
  let auditLogServiceMock: { log: jest.Mock };
  let reflectorMock: { get: jest.Mock };
  let interceptor: AuditLogInterceptor;

  const makeContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of({ ok: true }) };

  beforeEach(() => {
    auditLogServiceMock = { log: jest.fn().mockResolvedValue(null) };
    reflectorMock = { get: jest.fn() };
    interceptor = new AuditLogInterceptor(
      reflectorMock as unknown as Reflector,
      auditLogServiceMock as unknown as AuditLogService,
    );
  });

  it('is a no-op on routes without @Audit metadata', async () => {
    reflectorMock.get.mockReturnValue(undefined);

    const result = await lastValueFrom(
      interceptor.intercept(makeContext({ user: { id: 'a-1' }, headers: {} }), next),
    );

    expect(result).toEqual({ ok: true });
    expect(auditLogServiceMock.log).not.toHaveBeenCalled();
  });

  it('logs the action with actor, target, ip and sanitized details on success', async () => {
    reflectorMock.get.mockReturnValue({
      action: 'CREATOR_NOTE_CREATED',
      targetUserParam: 'id',
    } satisfies AuditMeta);

    await lastValueFrom(
      interceptor.intercept(
        makeContext({
          user: { id: 'admin-1' },
          params: { id: 'creator-9' },
          query: {},
          body: { note: 'hello', password: 'hunter2' },
          ip: '1.2.3.4',
          headers: { 'user-agent': 'jest' },
        }),
        next,
      ),
    );

    expect(auditLogServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-1',
        action: 'CREATOR_NOTE_CREATED',
        targetUserId: 'creator-9',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
        details: expect.objectContaining({
          body: { note: 'hello', password: '[REDACTED]' },
        }),
      }),
    );
  });

  it('skips logging when the request has no authenticated user', async () => {
    reflectorMock.get.mockReturnValue({ action: 'FEE_CREATED' } satisfies AuditMeta);

    await lastValueFrom(interceptor.intercept(makeContext({ headers: {} }), next));

    expect(auditLogServiceMock.log).not.toHaveBeenCalled();
  });

  it('truncates oversized string fields in details', async () => {
    reflectorMock.get.mockReturnValue({ action: 'BROADCAST_CREATED' } satisfies AuditMeta);

    await lastValueFrom(
      interceptor.intercept(
        makeContext({
          user: { id: 'admin-1' },
          body: { message: 'x'.repeat(2000) },
          headers: {},
        }),
        next,
      ),
    );

    const details = (auditLogServiceMock.log.mock.calls[0][0] as { details: any }).details;
    expect((details.body.message as string).length).toBeLessThan(600);
    expect(details.body.message).toContain('[truncated]');
  });
});
