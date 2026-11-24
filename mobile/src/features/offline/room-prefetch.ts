import type { QueryClient } from '@tanstack/react-query';
import { roomKeys } from '@/features/catalogue/room-queries';
import { ExpoFileSystemGlbCache, type GlbCacheAdapter } from '@/features/scene3d/glbCache';
import { GlbLoadError, loadGlbModel } from '@/features/scene3d/glbLoader';
import type { PublicModel } from '@/features/scene3d/glbSchema';
import { disposeModel } from '@/features/scene3d/glbValidation';
import type { PublicRoomPayload } from '@/features/scene3d/museumTypes';
import { publicRoomApi } from '@/features/scene3d/publicRoomApi';
import { formatBytes } from '@/shared/format-bytes';

/**
 * Tải trước một phòng để xem offline (MOB-E12-02): nội dung phòng (react-query, lưu đĩa) + model 3D.
 * Model phải vào `glbCache` vì màn 3D và AR chỉ đọc ở đó.
 */
export const OFFLINE_STATUS_KEY = ['offline-status'] as const;

/** File lớn trên mạng di động: lâu hơn mặc định 25s của màn xem. */
const MODEL_TIMEOUT_MS = 5 * 60_000;

export interface OfflineModelCache extends GlbCacheAdapter {
  has(checksumSha256: string, sizeBytes: number): Promise<boolean>;
}

// Cùng thư mục với cache mặc định của glbLoader/arModelSource.
export const offlineModelCache: OfflineModelCache = new ExpoFileSystemGlbCache();

/** Model của phòng, mỗi checksum một lần. */
export function roomModels(room: PublicRoomPayload): PublicModel[] {
  const unique = new Map<string, PublicModel>();
  for (const { model } of room.exhibits) if (model) unique.set(model.checksumSha256, model);
  return [...unique.values()];
}

export async function isRoomAvailableOffline(room: PublicRoomPayload, cache = offlineModelCache): Promise<boolean> {
  for (const model of roomModels(room)) {
    if (!(await cache.has(model.checksumSha256, model.sizeBytes))) return false;
  }
  return true;
}

/** Tải, kiểm SHA-256 và lưu một model; lỗi nếu không chắc chắn đã ghi xuống đĩa. */
async function storeModel(model: PublicModel, cache: OfflineModelCache, signal: AbortSignal, load: typeof loadGlbModel) {
  const beforeParse = new AbortController();
  const onAbort = () => beforeParse.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  // loadGlbModel bỏ qua lỗi ghi cache (chỉ cần để xem ngay) → giữ lại lỗi để báo người dùng.
  let writeError: unknown = null;
  const recording: GlbCacheAdapter = {
    getBuffer: (key) => cache.getBuffer(key),
    putBuffer: (key, buffer) =>
      cache.putBuffer(key, buffer).catch((error: unknown) => {
        writeError = error;
        throw error;
      }),
    remove: (key) => cache.remove(key),
    clear: () => cache.clear(),
    getStats: () => cache.getStats(),
  };
  try {
    const asset = await load({
      model,
      cache: recording,
      signal: beforeParse.signal,
      timeoutMs: MODEL_TIMEOUT_MS,
      // >= 0.85: đã kiểm và lưu xong, sắp giải mã — chỉ cần file nên dừng ở đây.
      onProgress: (ratio) => ratio >= 0.85 && beforeParse.abort(),
    });
    disposeModel(asset.scenes);
  } catch (error) {
    const stoppedOnPurpose = error instanceof GlbLoadError && error.category === 'aborted' && !signal.aborted;
    if (!stoppedOnPurpose) throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
  if (writeError || !(await cache.has(model.checksumSha256, model.sizeBytes))) {
    throw new Error('Không lưu được mô hình xuống máy. Kiểm tra dung lượng trống rồi thử lại.');
  }
}

export interface PrefetchResult {
  total: number;
  failed: number;
  /** Lý do của lỗi đầu tiên. */
  message: string | null;
}

export interface PrefetchDeps {
  cache?: OfflineModelCache;
  load?: typeof loadGlbModel;
}

/**
 * Tải nội dung rồi lần lượt từng model (tuần tự: mỗi model nằm trọn trong RAM khi tải).
 * Một model lỗi không dừng các model còn lại; gọi lại chỉ tải phần thiếu. Hủy thì ném `AbortError`.
 */
export function prefetchRoom(...args: Parameters<typeof runPrefetch>): Promise<PrefetchResult> {
  // Từng phòng một: index của glbCache không có khóa, và tải song song nhân đôi RAM.
  const run = queue.then(() => runPrefetch(...args));
  queue = run.catch(() => undefined);
  return run;
}

let queue: Promise<unknown> = Promise.resolve();

async function runPrefetch(
  client: QueryClient,
  slug: string,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
  { cache = offlineModelCache, load = loadGlbModel }: PrefetchDeps = {},
): Promise<PrefetchResult> {
  const throwIfAborted = () => {
    if (signal.aborted) throw Object.assign(new Error('Đã hủy tải.'), { name: 'AbortError' });
  };
  throwIfAborted();
  const room = await client.fetchQuery({
    queryKey: roomKeys.detail(slug),
    queryFn: ({ signal: querySignal }) => publicRoomApi.detail(slug, querySignal),
    staleTime: 0,
  });
  throwIfAborted();

  const models = roomModels(room);
  const bytes = models.reduce((sum, model) => sum + model.sizeBytes, 0);
  const { maxBytes } = await cache.getStats();
  // Vượt hạn mức thì LRU xóa chính các model vừa tải của phòng này.
  if (bytes > maxBytes) {
    throw new Error(`Phòng cần ${formatBytes(bytes)}, vượt bộ nhớ đệm mô hình 3D (${formatBytes(maxBytes)}).`);
  }

  let failed = 0;
  let message: string | null = null;
  for (const [index, model] of models.entries()) {
    throwIfAborted();
    onProgress(index, models.length);
    try {
      // Đọc lại cả model đã có: cập nhật thời điểm dùng để LRU không xóa khi tải model sau, và kiểm hash.
      await storeModel(model, cache, signal, load);
    } catch (error) {
      throwIfAborted();
      failed += 1;
      message ??= error instanceof Error ? error.message : 'Không tải được mô hình 3D.';
    }
  }
  throwIfAborted();
  onProgress(models.length, models.length);
  return { total: models.length, failed, message };
}
