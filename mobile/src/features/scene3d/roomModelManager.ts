import type { MuseumDisplay } from './museumTypes';
import type { GlbCacheAdapter } from './glbCache';
import {
  GlbLoadError,
  loadGlbModel,
  type LoadedGlbAsset,
  type LoadGlbOptions,
} from './glbLoader';
import { disposeModel } from './glbValidation';

export type RoomModelState =
  | { status: 'loading'; progress: number }
  | { status: 'ready'; asset: LoadedGlbAsset }
  | { status: 'error'; message: string; category: string };

export interface RoomModelManagerOptions {
  /** Số lượng GLB tải/giải mã đồng thời tối đa để bảo vệ RAM thiết bị di động (mặc định 2). */
  maxConcurrent?: number;
  apiBaseUrl?: string;
  cache?: GlbCacheAdapter;
  fetchImpl?: LoadGlbOptions['fetchImpl'];
  sha256Impl?: LoadGlbOptions['sha256Impl'];
  loaderImpl?: (options: LoadGlbOptions) => Promise<LoadedGlbAsset>;
}

/**
 * Bộ quản lý tải nhiều hiện vật GLB trong một phòng trưng bày (MOB-E6-04):
 * - Gộp yêu cầu trùng `checksumSha256` để không tải/giải mã 2 lần.
 * - Giới hạn số lượng tải đồng thời (`maxConcurrent`) tránh đột biến RAM trên điện thoại yếu.
 * - Cô lập lỗi từng hiện vật (1 mô hình hỏng không ảnh hưởng các bục còn lại).
 * - Hủy toàn bộ yêu cầu đang chạy và giải phóng GPU `disposeModel` khi rời phòng.
 */
export class RoomModelManager {
  private readonly maxConcurrent: number;
  private readonly options: RoomModelManagerOptions;
  private readonly assetsByChecksum = new Map<string, LoadedGlbAsset>();
  private readonly statesByExhibit = new Map<string, RoomModelState>();
  private controller: AbortController | null = null;
  private disposed = false;

  constructor(options: RoomModelManagerOptions = {}) {
    this.options = options;
    this.maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent ?? 2));
  }

  getStates(): ReadonlyMap<string, RoomModelState> {
    return new Map(this.statesByExhibit);
  }

  async loadRoomDisplays(
    displays: readonly MuseumDisplay[],
    onUpdate?: (states: ReadonlyMap<string, RoomModelState>) => void,
  ): Promise<ReadonlyMap<string, RoomModelState>> {
    this.dispose();
    this.disposed = false;
    const controller = new AbortController();
    this.controller = controller;

    // Nhóm các hiện vật dùng chung checksum để chỉ tải 1 lần.
    const groups = new Map<string, { display: MuseumDisplay; exhibitIds: string[] }>();
    for (const display of displays) {
      if (!display.model || display.isOutsideRoom) continue;
      const checksum = display.model.checksumSha256;
      const existing = groups.get(checksum);
      if (existing) {
        existing.exhibitIds.push(display.id);
      } else {
        groups.set(checksum, { display, exhibitIds: [display.id] });
      }
      this.statesByExhibit.set(display.id, { status: 'loading', progress: 0 });
    }

    onUpdate?.(this.getStates());
    const queue = Array.from(groups.values());
    if (queue.length === 0) return this.getStates();

    const loader = this.options.loaderImpl ?? loadGlbModel;
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < queue.length && !controller.signal.aborted && !this.disposed) {
        const item = queue[cursor++];
        if (!item?.display.model) continue;
        const model = item.display.model;

        try {
          const asset = await loader({
            model,
            apiBaseUrl: this.options.apiBaseUrl,
            cache: this.options.cache,
            fetchImpl: this.options.fetchImpl,
            sha256Impl: this.options.sha256Impl,
            signal: controller.signal,
            onProgress: (ratio) => {
              if (controller.signal.aborted || this.disposed) return;
              for (const id of item.exhibitIds) {
                this.statesByExhibit.set(id, { status: 'loading', progress: ratio });
              }
              onUpdate?.(this.getStates());
            },
          });

          if (controller.signal.aborted || this.disposed) {
            disposeModel(asset.scenes);
            return;
          }

          this.assetsByChecksum.set(model.checksumSha256, asset);
          for (const id of item.exhibitIds) {
            this.statesByExhibit.set(id, { status: 'ready', asset });
          }
          onUpdate?.(this.getStates());
        } catch (error) {
          if (controller.signal.aborted || this.disposed) return;
          const message =
            error instanceof GlbLoadError
              ? error.message
              : 'Không thể tải mô hình 3D của hiện vật.';
          const category = error instanceof GlbLoadError ? error.category : 'unknown';
          for (const id of item.exhibitIds) {
            this.statesByExhibit.set(id, { status: 'error', message, category });
          }
          onUpdate?.(this.getStates());
        }
      }
    };

    const workerCount = Math.min(this.maxConcurrent, queue.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return this.getStates();
  }

  /** Hủy mọi tải đang chạy và giải phóng GPU của toàn bộ mô hình đã tải trong phòng. */
  dispose(): void {
    this.disposed = true;
    this.controller?.abort();
    this.controller = null;
    for (const asset of this.assetsByChecksum.values()) {
      disposeModel(asset.scenes);
    }
    this.assetsByChecksum.clear();
    this.statesByExhibit.clear();
  }
}
