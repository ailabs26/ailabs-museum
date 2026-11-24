import type { QueryClient } from '@tanstack/react-query';
import { clearImageCache } from '@/core/cache/cache-policy';
import { fileCache } from '@/core/cache/file-cache';
import { SESSION_QUERY_KEY } from '@/core/query/query-client';
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

const isCatalogue = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== SESSION_QUERY_KEY[0];

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
