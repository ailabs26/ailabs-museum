import { Media, MediaKind, MediaProcessingState } from '../entities/media.entity';

export interface MediaResponse {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  processingState: MediaProcessingState;
  /** URL công khai; `null` với media trong vùng cách ly. */
  url: string | null;
  originalName: string | null;
  altText: string | null;
  source: string | null;
  author: string | null;
  license: string | null;
  createdById: string | null;
  createdAt: Date;
}

/** Ánh xạ entity → response; không lộ `storageKey` (chi tiết lưu trữ nội bộ). */
export function toMediaResponse(media: Media, url: string | null): MediaResponse {
  return {
    id: media.id,
    kind: media.kind,
    mimeType: media.mimeType,
    // bigint từ pg là chuỗi; file tối đa 10 MB nên Number an toàn.
    sizeBytes: Number(media.sizeBytes),
    checksumSha256: media.checksumSha256,
    processingState: media.processingState,
    url,
    originalName: media.originalName ?? null,
    altText: media.altText ?? null,
    source: media.source ?? null,
    author: media.author ?? null,
    license: media.license ?? null,
    createdById: media.createdById ?? null,
    createdAt: media.createdAt,
  };
}
