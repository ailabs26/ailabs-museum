import { Image, type ImageProps } from 'expo-image';
import type { CacheKind, CachedFile } from './file-cache';

/**
 * Chính sách dung lượng cache media (MOB-E3-06).
 *
 * - GLB/audio (`fileCache`): hạn mức theo loại; vượt thì xóa file lâu không dùng nhất (LRU).
 *   File vừa tải luôn được giữ, kể cả khi riêng nó đã vượt hạn mức.
 * - Ảnh: `expo-image` tự quản lý cache trên đĩa (SDWebImage/Glide, hệ điều hành dọn khi thiếu chỗ);
 *   app chỉ chọn chính sách và xóa được toàn bộ (không đo được dung lượng ảnh).
 */
const MB = 1024 * 1024;

/** Hạn mức mặc định — chỉnh theo số liệu thiết bị thật (xem docs/tasks/mobile-data-core.md). */
export const CACHE_LIMITS: Readonly<Record<CacheKind, number>> = {
  glb: 500 * MB,
  audio: 200 * MB,
};

/** Ảnh catalogue/hiện vật: nhớ trong RAM khi đang xem, lưu đĩa để xem lại offline. */
export const IMAGE_CACHE_POLICY: NonNullable<ImageProps['cachePolicy']> = 'memory-disk';

/**
 * Chọn file cần xóa để tổng dung lượng về dưới `limitBytes`: cũ nhất (ít dùng gần đây nhất) trước.
 * Không bao giờ chọn file trong `keep` (vd file vừa tải xong).
 */
export function selectEvictions(entries: readonly CachedFile[], limitBytes: number, keep: readonly string[] = []): CachedFile[] {
  let total = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (total <= limitBytes) return [];
  const victims: CachedFile[] = [];
  const candidates = entries
    .filter((entry) => !keep.includes(entry.key))
    .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  for (const entry of candidates) {
    if (total <= limitBytes) break;
    victims.push(entry);
    total -= entry.sizeBytes;
  }
  return victims;
}

/** Xóa cache ảnh của expo-image (RAM + đĩa). */
export async function clearImageCache(): Promise<void> {
  await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
}
