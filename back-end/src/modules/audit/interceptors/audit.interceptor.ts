import { randomUUID } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuthUser } from '../../../common/types/auth-user.type';
import { userAgentOf } from '../audit-request.util';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuditService } from '../services/audit.service';

type AuditRequest = Request & { user?: AuthUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<AuditRequest>();

    return next.handle().pipe(
      mergeMap(async (data) => {
        try {
          const resourceIds = this.resolveResourceIds(request, data);
          for (const resourceId of resourceIds) {
            await this.audit.record({
              actorId: request.user?.id ?? null,
              action: meta.action,
              resourceType: meta.resourceType,
              resourceId,
              // Với hành động trên revision, lưu thêm FK revisionId để truy vết chéo.
              revisionId: meta.resourceType === 'revision' ? resourceId : null,
              reason: this.resolveReason(request),
              requestId: this.resolveRequestId(request),
              ip: request.ip ?? null,
              userAgent: userAgentOf(request),
            });
          }
        } catch {
          // Không để lỗi ghi audit làm hỏng response chính.
        }
        return data;
      }),
    );
  }

  /**
   * APP_INTERCEPTOR nằm ngoài ResponseInterceptor (đăng ký ở main.ts), nên kết quả nhận được
   * có thể đã được bọc thành ApiResponse `{ success, data, message }` — lấy phần `data`.
   */
  private unwrapEnvelope(data: unknown): unknown {
    if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
      return (data as { data: unknown }).data;
    }
    return data;
  }

  /**
   * Ưu tiên danh sách id (`roleIds` của ma trận quyền, `ids` của thao tác hàng loạt → 1 bản ghi/ID),
   * rồi id trả về (tạo mới), sau đó tới param :id.
   */
  private resolveResourceIds(request: AuditRequest, result: unknown): string[] {
    const data = this.unwrapEnvelope(result);
    for (const key of ['roleIds', 'ids'] as const) {
      if (data && typeof data === 'object' && key in data) {
        const ids = (data as Record<string, unknown>)[key];
        if (Array.isArray(ids)) {
          return ids.filter((id): id is string => typeof id === 'string');
        }
      }
    }
    if (data && typeof data === 'object' && 'id' in data) {
      const id = (data as { id?: unknown }).id;
      if (typeof id === 'string') return [id];
    }
    const paramId = (request.params as Record<string, string> | undefined)?.id;
    return paramId ? [paramId] : [];
  }

  private resolveReason(request: AuditRequest): string | null {
    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') return null;
    if (typeof body.reason === 'string' && body.reason.trim().length > 0) {
      return body.reason.trim();
    }
    if (typeof body.resolution === 'string' && body.resolution.trim().length > 0) {
      return body.resolution.trim();
    }
    return null;
  }

  private resolveRequestId(request: AuditRequest): string {
    const header = request.headers['x-request-id'];
    if (typeof header === 'string' && header.length > 0) return header.slice(0, 100);
    return randomUUID();
  }
}
