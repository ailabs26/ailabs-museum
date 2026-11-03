import { http } from '@/core/api/http-client';
import type { Page } from '@/core/api/api-response';
import type { MediaKind } from '@/helpers/mediaLibrary';

export type { MediaKind };

export type MediaProcessingState = 'pending' | 'ready' | 'failed' | 'quarantined';

/** Media trong thư viện CMS — `url` đã ký (xem được cả media chưa xuất bản), `null` khi bị cách ly. */
export interface MediaItem {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  processingState: MediaProcessingState;
  url: string | null;
  originalName: string | null;
  altText: string | null;
  source: string | null;
  author: string | null;
  license: string | null;
  createdById: string | null;
  createdAt: string;
  /** Chỉ có khi xem mục Đã xóa. */
  deletedAt?: string | null;
}

export interface ListMediaParams {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: MediaKind;
  state?: MediaProcessingState;
  /** true: mục Đã xóa (thùng rác). */
  deleted?: boolean;
}

/** Metadata mô tả & quyền sử dụng (FR-97). `null` = xóa giá trị. File không bao giờ bị thay. */
export interface UpdateMediaInput {
  altText?: string | null;
  source?: string | null;
  author?: string | null;
  license?: string | null;
}

export interface UploadMediaOptions {
  kind?: MediaKind;
  onProgress?: (ratio: number) => void;
}

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  model: 'Model 3D (GLB)',
  image: 'Hình ảnh',
  audio: 'Audio (MP3)',
  subtitle: 'Phụ đề (WebVTT)',
};

export const MEDIA_STATE_LABEL: Record<MediaProcessingState, string> = {
  pending: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
  quarantined: 'Bị cách ly',
};

export const mediaService = {
  list(params: ListMediaParams): Promise<Page<MediaItem>> {
    return http.getPage<MediaItem>('/admin/media', { params });
  },

  get(id: string): Promise<MediaItem> {
    return http.get<MediaItem>(`/admin/media/${id}`);
  },

  /** Nội dung file (cần đăng nhập) — dùng cả cho file seed không có URL ký. */
  async content(id: string, signal?: AbortSignal): Promise<Blob> {
    const res = await http.raw.get<Blob>(`/admin/media/${id}/content`, { responseType: 'blob', signal });
    return res.data;
  },

  /** Upload multipart (field `file`); `kind` giúp back-end báo lỗi khi nội dung không khớp loại đã chọn. */
  upload(file: File, { kind, onProgress }: UploadMediaOptions = {}): Promise<MediaItem> {
    const form = new FormData();
    form.append('file', file);
    if (kind) form.append('kind', kind);
    return http.post<MediaItem>('/admin/media/upload', form, {
      // File tới 10 MB: nới timeout mặc định 20 s.
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded / event.total);
      },
    });
  },

  update(id: string, input: UpdateMediaInput): Promise<MediaItem> {
    return http.patch<MediaItem>(`/admin/media/${id}`, input);
  },

  delete(id: string): Promise<void> {
    return http.delete<void>(`/admin/media/${id}`);
  },
  /** Xóa mềm nhiều media (giữ file): tất cả hoặc không (409 kèm lý do từng ID). */
  async removeMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/admin/media/bulk-delete', { ids });
  },
  /** Khôi phục media đã xóa (file được giữ): tất cả hoặc không (409 kèm lý do từng ID). */
  async restoreMany(ids: string[]): Promise<void> {
    await http.post<unknown>('/admin/media/bulk-restore', { ids });
  },
};
