import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { AuditLog } from '../entities/audit-log.entity';
import { ListAuditQueryDto } from '../dto/list-audit-query.dto';
import { AuditRepository } from '../repositories/audit.repository';
import type { RecordAccessDeniedInput } from '../dto/record-access-denied.dto';

export interface RecordAuditInput {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  revisionId?: string | null;
  reason?: string | null;
  requestId: string;
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
      }),
    );
  }

  /** Ghi sự kiện bảo mật; lỗi lưu audit không được thay đổi kết quả từ chối 403. */
  async recordAccessDenied(input: RecordAccessDeniedInput): Promise<void> {
    try {
      await this.record({
        actorId: input.actorId,
        action: 'access.denied',
        resourceType: 'access',
        // Request list/create chưa có tài nguyên: dùng UUID sự kiện, không dùng id giả.
        resourceId: randomUUID(),
        requestId: input.requestId,
        reason: JSON.stringify({
          status: 403,
          method: input.method,
          route: input.route,
          requiredPermissions: input.requiredPermissions,
          missingPermissions: input.missingPermissions,
        }),
      });
    } catch {
      this.logger.warn(JSON.stringify({
        action: 'access.denied',
        requestId: input.requestId,
        message: 'Không ghi được audit cho truy cập bị từ chối',
      }));
    }
  }

  list(query: ListAuditQueryDto): Promise<Paginated<AuditLog>> {
    return this.audit.listPaginated({
      page: query.page,
      pageSize: query.pageSize,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  async getById(id: string): Promise<AuditLog> {
    const log = await this.audit.findOne({ id }, { relations: ['actor'] });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi nhật ký');
    return log;
  }
}
