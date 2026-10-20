import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';
import type { RevisionContent, UserBrief } from '@/services/moderation.service';

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface ReportedRevisionBrief {
  id: string;
  revisionNo: number;
  state: string;
  content: RevisionContent;
}

export interface ContentReport {
  id: string;
  exhibitId: string;
  category: string;
  message: string;
  status: ReportStatus;
  assignedTo: UserBrief | null;
  resolution: string | null;
  reportedRevision: ReportedRevisionBrief | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ListReportsParams {
  page?: number;
  pageSize?: number;
  status?: ReportStatus;
}

export const reportsService = {
  list(params: ListReportsParams): Promise<Page<ContentReport>> {
    return http.getPage<ContentReport>('/reports', { params });
  },
  get(id: string): Promise<ContentReport> {
    return http.get<ContentReport>(`/reports/${id}`);
  },
  assign(id: string): Promise<ContentReport> {
    return http.post<ContentReport>(`/reports/${id}/assign`);
  },
  resolve(id: string, resolution: string): Promise<ContentReport> {
    return http.post<ContentReport>(`/reports/${id}/resolve`, { resolution });
  },
  dismiss(id: string, resolution: string): Promise<ContentReport> {
    return http.post<ContentReport>(`/reports/${id}/dismiss`, { resolution });
  },
};
