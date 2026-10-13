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
              requestId: this.resolveRequestId(request),
            });
          }
        } catch {
          // Không để lỗi ghi audit làm hỏng response chính.
        }
        return data;
      }),
    );
  }

  /** Ưu tiên danh sách id, rồi id trả về (tạo mới), sau đó tới param :id. */
  private resolveResourceIds(request: AuditRequest, data: unknown): string[] {
    if (data && typeof data === 'object' && 'roleIds' in data) {
      const roleIds = (data as { roleIds?: unknown }).roleIds;
      if (Array.isArray(roleIds)) {
        return roleIds.filter((id): id is string => typeof id === 'string');
      }
    }
    if (data && typeof data === 'object' && 'id' in data) {
      const id = (data as { id?: unknown }).id;
      if (typeof id === 'string') return [id];
    }
    const paramId = (request.params as Record<string, string> | undefined)?.id;
    return paramId ? [paramId] : [];
  }

  private resolveRequestId(request: AuditRequest): string {
    const header = request.headers['x-request-id'];
    if (typeof header === 'string' && header.length > 0) return header.slice(0, 100);
    return randomUUID();
  }
}
