import type { Query, QueryClient } from '@tanstack/react-query';
import { clearImageCache } from '@/core/cache/cache-policy';
import { fileCache } from '@/core/cache/file-cache';
import { OFFLINE_STATUS_KEY } from '@/features/offline/room-prefetch';
import { ExpoFileSystemGlbCache } from '@/features/scene3d/glbCache';

/** Xem và xóa dữ liệu lưu trên máy (MOB-E12-04). */
export const STORAGE_GROUPS = ['models', 'audio', 'images', 'catalogue'] as const;
export type StorageGroup = (typeof STORAGE_GROUPS)[number];

export interface MediaUsage {
  models: number;
  audio: number;
}

// Cùng thư mục và index trên đĩa với cache mặc định của glbLoader/arModelSource.
// TODO(MOB-E6-02): bỏ khi TV4 chuyển GlbCacheAdapter sang fileCache.
const glbCache = new ExpoFileSystemGlbCache();

/** null khi không có file system (web). */
export async function getMediaUsage(): Promise<MediaUsage | null> {
  if (!fileCache.enabled) return null;
  const [files, glb] = await Promise.all([fileCache.getUsage(), glbCache.getStats()]);
  return { models: files.glb.bytes + glb.totalBytes, audio: files.audio.bytes };
}

// Dữ liệu riêng của người dùng và trạng thái tạm đều đánh dấu `persist: false`.
const isCatalogue = (query: Query) => query.meta?.persist !== false;

/** Số nội dung đã tải (phòng, danh sách...) — không tính dữ liệu riêng của người dùng. */
export function countCatalogue(client: QueryClient): number {
  return client.getQueryCache().findAll({ predicate: isCatalogue }).filter((q) => q.state.data !== undefined).length;
}

export async function clearStorage(group: StorageGroup, client: QueryClient): Promise<void> {
  switch (group) {
    case 'models':
      if (!fileCache.enabled) return;
      await fileCache.clear('glb');
      await glbCache.clear();
      void client.invalidateQueries({ queryKey: OFFLINE_STATUS_KEY });
      return;
    case 'audio':
      return fileCache.clear('audio');
    case 'images':
      return clearImageCache();
    case 'catalogue':
      // Đưa về trạng thái chưa tải: persister bỏ khỏi đĩa, màn đang mở tự tải lại. Không chờ: offline thì treo.
      void client.resetQueries({ predicate: isCatalogue });
  }
}
