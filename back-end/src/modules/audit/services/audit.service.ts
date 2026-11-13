import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { AuditLogResponse, toAuditLogResponse } from '../dto/audit-log-response.dto';
import { toAuditCsv } from '../audit-csv.util';
import type { AuditClientInfo } from '../audit-request.util';
import { ExportAuditQueryDto } from '../dto/export-audit-query.dto';
import { ListAuditQueryDto } from '../dto/list-audit-query.dto';
import { AuditFilter, AuditRepository } from '../repositories/audit.repository';
import type { RecordAccessDeniedInput } from '../dto/record-access-denied.dto';

/** Trần số dòng một lần xuất CSV; vượt thì yêu cầu thu hẹp bộ lọc thay vì cắt bớt âm thầm. */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

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
    const page = await this.audit.listPaginated({ page: query.page, pageSize: query.pageSize, ...toFilter(query) });
    return { ...page, items: page.items.map(toAuditLogResponse) };
  }

  /**
   * CSV các bản ghi khớp bộ lọc (mới nhất trước). Quá `AUDIT_EXPORT_MAX_ROWS` → 400, không cắt bớt:
   * nhật ký thiếu dòng mà không báo là sai lệch nguy hiểm. Bản thân việc xuất cũng được ghi vết.
   */
  async exportCsv(query: ExportAuditQueryDto, actorId: string, client: AuditClientInfo): Promise<string> {
    const filter = toFilter(query);
    const logs = await this.audit.listForExport(filter, AUDIT_EXPORT_MAX_ROWS + 1);
    if (logs.length > AUDIT_EXPORT_MAX_ROWS) {
      throw new BadRequestException(
        `Có hơn ${AUDIT_EXPORT_MAX_ROWS.toLocaleString('vi-VN')} bản ghi khớp bộ lọc, vui lòng thu hẹp khoảng thời gian hoặc bộ lọc`,
      );
    }
    await this.recordSafely({
      actorId, action: 'audit.export', resourceType: 'audit', resourceId: null,
      reason: JSON.stringify({ filter: query, rows: logs.length }),
      ...client,
    });
    return toAuditCsv(logs.map(toAuditLogResponse));
  }

  async getById(id: string): Promise<AuditLogResponse> {
    const log = await this.audit.findOne({ id }, { relations: ['actor'] });
    if (!log) throw new NotFoundException('Không tìm thấy bản ghi nhật ký');
    return toAuditLogResponse(log);
  }
}

function toFilter(query: ExportAuditQueryDto): AuditFilter {
  return {
    actorId: query.actorId,
    action: query.action,
    resourceType: query.resourceType,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}
