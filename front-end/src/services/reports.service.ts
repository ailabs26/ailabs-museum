import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';
import type { RevisionContent, UserBrief } from '@/services/moderation.service';

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export const PUBLIC_REPORT_CATEGORIES = [
  { value: 'wrong_info', label: 'Sai thông tin' },
  { value: 'typo', label: 'Lỗi chính tả' },
  { value: 'inappropriate_content', label: 'Ảnh/nội dung không phù hợp' },
  { value: 'other', label: 'Khác' },
] as const;
export type PublicReportCategory = (typeof PUBLIC_REPORT_CATEGORIES)[number]['value'];

export function reportCategoryLabel(category: string): string {
  return PUBLIC_REPORT_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export interface CreatePublicReportInput {
  exhibitId: string;
  reportedRevisionId: string;
  category: PublicReportCategory;
  message: string;
}

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
  createPublic(input: CreatePublicReportInput): Promise<ContentReport> {
    return http.post<ContentReport>('/public/reports', input);
  },
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
