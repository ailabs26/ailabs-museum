import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';
import type { BilingualText } from './exhibits.service';

export interface RevisionContent {
  name: string | BilingualText | null;
  description: string | BilingualText | null;
  position: { x: number; y: number; z: number };
  transcript?: string | BilingualText | null;
  placeholderShape?: string;
  placeholderColor?: string;
}

export interface UserBrief {
  id: string;
  email: string;
  displayName: string;
}

export interface ExhibitBrief {
  id: string;
  roomId: string;
  visibility: string;
  version: number;
  publishedRevisionId: string | null;
}

export interface Revision {
  id: string;
  exhibitId: string;
  revisionNo: number;
  state: string;
  content: RevisionContent;
  createdBy: UserBrief | null;
  reviewedBy: UserBrief | null;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  exhibit?: ExhibitBrief;
}

export interface DiffField {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

export interface RevisionDiff {
  revisionId: string;
  exhibitId: string;
  publishedRevisionNo: number | null;
  targetRevisionNo: number;
  fields: DiffField[];
}

export interface QueueParams {
  page?: number;
  pageSize?: number;
  roomId?: string;
}

export const moderationService = {
  queue(params: QueueParams): Promise<Page<Revision>> {
    return http.getPage<Revision>('/moderation/queue', { params });
  },
  getRevision(id: string): Promise<Revision> {
    return http.get<Revision>(`/moderation/revisions/${id}`);
  },
  diff(id: string): Promise<RevisionDiff> {
    return http.get<RevisionDiff>(`/moderation/revisions/${id}/diff`);
  },
  history(exhibitId: string): Promise<Revision[]> {
    return http.get<Revision[]>(`/exhibits/${exhibitId}/revisions`);
  },
  publish(id: string, version: number): Promise<Revision> {
    return http.post<Revision>(`/revisions/${id}/publish`, { version });
  },
  reject(id: string, version: number, reason: string): Promise<Revision> {
    return http.post<Revision>(`/revisions/${id}/reject`, { version, reason });
  },
  hide(exhibitId: string, version: number): Promise<ExhibitBrief> {
    return http.post<ExhibitBrief>(`/exhibits/${exhibitId}/hide`, { version });
  },
  unhide(exhibitId: string, version: number): Promise<ExhibitBrief> {
    return http.post<ExhibitBrief>(`/exhibits/${exhibitId}/unhide`, { version });
  },
};
