export type MediaKind = 'model' | 'image' | 'audio' | 'subtitle';

/**
 * Giới hạn dung lượng theo loại — khớp `media-formats.ts` của back-end (MB = 1.000.000 byte).
 * Chỉ để báo sớm cho người dùng; back-end vẫn là nơi kiểm tra thật (định dạng từ magic bytes).
 */
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
  model: 10_000_000,
  image: 2_000_000,
  audio: 10_000_000,
  subtitle: 1_000_000,
};

/** Đuôi file gợi ý cho ô chọn file (back-end không tin đuôi file). */
export const MEDIA_ACCEPT: Record<MediaKind, string> = {
  model: '.glb,model/gltf-binary',
  image: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  audio: '.mp3,audio/mpeg',
  subtitle: '.vtt,text/vtt',
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

/** Thông báo khi file vượt giới hạn của loại đã chọn; `null` nếu hợp lệ. */
export function uploadSizeError(sizeBytes: number, kind: MediaKind): string | null {
  const max = MEDIA_MAX_BYTES[kind];
  return sizeBytes > max ? `File ${formatBytes(sizeBytes)} vượt giới hạn ${formatBytes(max)} cho loại này` : null;
}

/** Đủ thông tin quyền sử dụng để Submit Review (thiếu → 422 `media_rights_missing`, FR-97). */
export function hasMediaRights(media: { source: string | null; author: string | null; license: string | null }): boolean {
  return [media.source, media.author, media.license].every((value) => !!value?.trim());
}
