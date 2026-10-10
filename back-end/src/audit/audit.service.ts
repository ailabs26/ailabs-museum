import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../common/types/paginated.type';
import { AuditLog } from '../audit-logs/audit-log.entity';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';
import { AuditRepository } from './repositories/audit.repository';

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
