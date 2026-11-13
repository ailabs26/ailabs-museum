import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { PermissionDeniedException } from '../../../common/exceptions/permission-denied.exception';
import { AllExceptionsFilter } from '../../../common/filters/all-exceptions.filter';
import { REQUEST_ID_HEADER } from '../../../common/middleware/request-id.middleware';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { userAgentOf } from '../audit-request.util';
import { AuditService } from '../services/audit.service';

type AuditRequest = Request & { user?: AuthUser };

/** Guard chạy trước interceptor, nên ghi audit RBAC ở exception filter. */
@Catch(PermissionDeniedException)
export class PermissionDeniedFilter extends AllExceptionsFilter {
  constructor(private readonly audit: AuditService) {
    super();
  }

  async catch(exception: PermissionDeniedException, host: ArgumentsHost): Promise<void> {
    const context = host.switchToHttp();
    const request = context.getRequest<AuditRequest>();
    const response = context.getResponse<Response>();
    const header = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof header === 'string' && header.trim()
      ? header.slice(0, 100)
      : randomUUID();
    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader('X-Request-Id', requestId);

    // Chỉ lưu route pattern của Express; không lưu URL/query/body/header chứa secret.
    const route = typeof request.route?.path === 'string'
      ? request.route.path.slice(0, 512)
      : '(unknown route)';
    const actorId = request.user?.id;
    await this.audit.recordAccessDenied({
      actorId: actorId && isUUID(actorId) ? actorId : null,
      method: request.method,
      route,
      requiredPermissions: exception.requiredPermissions,
      missingPermissions: exception.missingPermissions,
      requestId,
      ip: request.ip?.slice(0, 64) ?? null,
      userAgent: userAgentOf(request),
    });

    super.catch(exception, host);
  }
}
