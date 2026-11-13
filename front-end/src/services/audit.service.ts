import { http } from '@/core/api/http-client';
import { filenameFromDisposition } from '@/helpers/saveBlob';
import type { Page } from '@/core/api/api-response';

export interface AuditActor {
  id: string;
  email: string;
  displayName: string;
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  actor: AuditActor | null;
  action: string;
  resourceType: string;
  /** null khi sự kiện không gắn tài nguyên (vd đăng nhập bằng email không tồn tại). */
  resourceId: string | null;
  revisionId: string | null;
  reason: string | null;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  occurredAt: string;
}

/**
 * Nhãn người thực hiện: sự kiện xác thực/truy cập không có actor là người CHƯA đăng nhập
 * (vd đăng nhập sai), không phải do hệ thống tự làm.
 */
export function actorLabel(row: Pick<AuditRow, 'actor' | 'action'>): string {
  if (row.actor) return row.actor.email;
  return row.action.startsWith('auth.') || row.action === 'access.denied' ? 'Chưa đăng nhập' : 'hệ thống';
}

export interface ListAuditParams {
  page?: number;
  pageSize?: number;
  actorId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export type ExportAuditParams = Omit<ListAuditParams, 'page' | 'pageSize'>;

// Giữ export cũ (test và nơi đang import từ đây); hàm nằm cùng helper tải file.
export { filenameFromDisposition };

export const auditService = {
  list(params: ListAuditParams): Promise<Page<AuditRow>> {
    return http.getPage<AuditRow>('/audit', { params });
  },
  /** Tải CSV theo bộ lọc (tối đa 10.000 dòng; quá thì back-end trả 400 kèm thông điệp). */
  async exportCsv(params: ExportAuditParams): Promise<{ blob: Blob; filename: string }> {
    const res = await http.raw.get<Blob>('/audit/export', { params, responseType: 'blob' });
    return { blob: res.data, filename: filenameFromDisposition(res.headers['content-disposition'], 'audit-logs.csv') };
  },
  get(id: string): Promise<AuditRow> {
    return http.get<AuditRow>(`/audit/${id}`);
  },
};
