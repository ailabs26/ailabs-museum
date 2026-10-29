import { http } from '@/core/api/http-client';
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

export const auditService = {
  list(params: ListAuditParams): Promise<Page<AuditRow>> {
    return http.getPage<AuditRow>('/audit', { params });
  },
  get(id: string): Promise<AuditRow> {
    return http.get<AuditRow>(`/audit/${id}`);
  },
};
