import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { AuditLogResponse, toAuditLogResponse } from '../dto/audit-log-response.dto';
import { ListAuditQueryDto } from '../dto/list-audit-query.dto';
import { AuditRepository } from '../repositories/audit.repository';
import type { RecordAccessDeniedInput } from '../dto/record-access-denied.dto';

export interface RecordAuditInput {
  actorId: string | null;
  action: string;
  resourceType: string;
  /** NULL khi sự kiện không gắn tài nguyên cụ thể — không dùng id giả. */
  resourceId: string | null;
  revisionId?: string | null;
  reason?: string | null;
  requestId: string;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly audit: AuditRepository) {}

  /** Ghi 1 bản ghi nhật ký (append-only). */
  async record(input: RecordAuditInput): Promise<void> {
    await this.audit.save(
      this.audit.create({
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        revisionId: input.revisionId ?? null,
        reason: input.reason ?? null,
        requestId: input.requestId,
        ip: input.ip?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
      }),
    );
  }

  /** Ghi audit nhưng lỗi lưu không được làm hỏng thao tác chính (đăng nhập, từ chối 403…); chỉ ghi cảnh báo. */
  async recordSafely(input: RecordAuditInput): Promise<void> {
    try {
      await this.record(input);
    } catch {
      this.logger.warn(JSON.stringify({
        action: input.action,
        requestId: input.requestId,
        message: 'Không ghi được audit',
      }));
    }
  }

  /** Ghi sự kiện bảo mật; lỗi lưu audit không được thay đổi kết quả từ chối 403. */
  recordAccessDenied(input: RecordAccessDeniedInput): Promise<void> {
    return this.recordSafely({
      actorId: input.actorId,
      action: 'access.denied',
      resourceType: 'access',
      // Sự kiện truy cập, không gắn một bản ghi nội dung cụ thể.
      resourceId: null,
      requestId: input.requestId,
      ip: input.ip,
      userAgent: input.userAgent,
      reason: JSON.stringify({
        status: 403,
        method: input.method,
        route: input.route,
        requiredPermissions: input.requiredPermissions,
        missingPermissions: input.missingPermissions,
      }),
    });
  }

  async list(query: ListAuditQueryDto): Promise<Paginated<AuditLogResponse>> {
    const page = await this.audit.listPaginated({
      page: query.page,
      pageSize: query.pageSize,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    return { ...page, items: page.items.map(toAuditLogResponse) };
  }

  async getById(id: string): Promise<AuditLogResponse> {
    const log = await this.audit.findOne({ id }, { relations: ['actor'] });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi nhật ký');
    return toAuditLogResponse(log);
  }
}
