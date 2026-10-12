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
  resourceId: string;
  revisionId: string | null;
  reason: string | null;
  requestId: string;
  occurredAt: string;
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
