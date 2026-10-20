import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';

export type ExhibitStatus = 'draft' | 'published';
export type RevisionState = 'draft' | 'in_review' | 'approved' | 'rejected';
export type ExhibitVisibility = 'visible' | 'hidden';

export interface BilingualText {
  vi?: string;
  en?: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ExhibitRow {
  id: string;
  roomId: string;
  status: ExhibitStatus;
  visibility: ExhibitVisibility;
  version: number;
  displayOrder: number;
  publishedRevisionId: string | null;
  currentRevisionNo: number;
  revisionState: RevisionState;
  content: {
    name: BilingualText | string;
    description: BilingualText | string;
    position: Vector3;
    rotation?: Vector3;
    scale?: Vector3;
    placeholderShape?: string;
    placeholderColor?: string;
    transcript?: unknown;
    modelId?: string | null;
    imageId?: string | null;
    audioId?: string | null;
  };
  hotspotsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExhibitDetail extends ExhibitRow {
  room: {
    id: string;
    name: string;
    slug: string;
  } | null;
  hotspots: Array<{
    id: string;
    label: unknown;
    body: unknown;
    position: Vector3;
    displayOrder: number;
  }>;
  revisions: Array<{
    id: string;
    revisionNo: number;
    state: RevisionState;
    createdById: string;
    createdBy: { id: string; name: string; email: string } | null;
    reviewedById: string | null;
    reviewedBy: { id: string; name: string; email: string } | null;
    reason: string | null;
    createdAt: string;
    reviewedAt: string | null;
  }>;
}

export interface ListExhibitsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  roomId?: string;
  status?: 'draft' | 'published' | 'all';
  visibility?: ExhibitVisibility;
  sort?: string;
}

export interface CreateExhibitInput {
  roomId: string;
  name?: BilingualText;
  description?: BilingualText;
  displayOrder?: number;
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  placeholderShape?: string;
  placeholderColor?: string;
  modelId?: string | null;
  imageId?: string | null;
  audioId?: string | null;
}

export interface UpdateExhibitInput {
  roomId?: string;
  name?: BilingualText;
  description?: BilingualText;
  displayOrder?: number;
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  placeholderShape?: string;
  placeholderColor?: string;
  modelId?: string | null;
  imageId?: string | null;
  audioId?: string | null;
}

export const exhibitsService = {
  list(params: ListExhibitsParams): Promise<Page<ExhibitRow>> {
    return http.getPage<ExhibitRow>('/admin/exhibits', { params });
  },

  get(id: string): Promise<ExhibitDetail> {
    return http.get<ExhibitDetail>(`/admin/exhibits/${id}`);
  },

  create(input: CreateExhibitInput): Promise<ExhibitRow> {
    return http.post<ExhibitRow>('/admin/exhibits', input);
  },

  update(id: string, input: UpdateExhibitInput): Promise<ExhibitRow> {
    return http.patch<ExhibitRow>(`/admin/exhibits/${id}`, input);
  },

  submitReview(id: string): Promise<ExhibitRow> {
    return http.post<ExhibitRow>(`/admin/exhibits/${id}/submit-review`);
  },

  delete(id: string): Promise<{ success: boolean; message: string }> {
    return http.delete<{ success: boolean; message: string }>(`/admin/exhibits/${id}`);
  },

  reorder(roomId: string, exhibitIds: string[]): Promise<{ success: boolean; message: string }> {
    return http.put<{ success: boolean; message: string }>(
      `/admin/exhibits/rooms/${roomId}/reorder`,
      { exhibitIds },
    );
  },
};
