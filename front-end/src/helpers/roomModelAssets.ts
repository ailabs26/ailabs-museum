import type { Group, Object3D } from 'three';
import type { ModelNormalization } from './modelNormalization';
import type { PublicModel } from '../validations/roomSchema';
import { disposeModel } from './glbAsset';

export interface LoadedModel { scene: Group; scenes: Object3D[]; normalization: ModelNormalization }
export type ModelLoadState =
  | { status: 'queued' | 'loading'; progress?: number }
  | { status: 'ready'; asset: LoadedModel }
  | { status: 'error'; message: string };
export type ModelSnapshot = Readonly<Record<string, ModelLoadState>>;
type LoadModel = (model: PublicModel, signal: AbortSignal, progress: (ratio: number) => void) => Promise<LoadedModel>;

/** One owner per open room. Shared bytes/resources, two active downloads, no global cache. */
export class RoomModelAssets {
  snapshot: ModelSnapshot = {};
  private readonly controller = new AbortController();
  private readonly models = new Map<string, PublicModel>();
  private queue: string[] = [];
  private active = 0;
  private closed = false;
  constructor(private readonly load: LoadModel, private readonly onChange: (value: ModelSnapshot) => void) {}

  start(models: readonly PublicModel[]) {
    if (this.closed || this.models.size) return;
    for (const model of models) this.models.set(model.checksumSha256, model);
    this.queue = [...this.models.keys()];
    this.snapshot = Object.fromEntries(this.queue.map(key => [key, { status: 'queued' }]));
    this.onChange(this.snapshot); this.pump();
  }

  retry(key: string) {
    if (this.closed || this.snapshot[key]?.status !== 'error') return;
    this.update(key, { status: 'queued' }); this.queue.push(key); this.pump();
  }

  dispose() {
    if (this.closed) return;
    this.closed = true; this.controller.abort(); this.queue = [];
    const assets = Object.values(this.snapshot).flatMap(state => state.status === 'ready' ? state.asset.scenes : []);
    this.snapshot = {}; this.models.clear();
    // React has detached primitives by the time resource disposal runs.
    queueMicrotask(() => disposeModel(assets));
  }

  private update(key: string, state: ModelLoadState) {
    if (this.closed) return;
    this.snapshot = { ...this.snapshot, [key]: state }; this.onChange(this.snapshot);
  }

  private pump() {
    while (!this.closed && this.active < 2 && this.queue.length) {
      const key = this.queue.shift()!; const model = this.models.get(key)!;
      this.active++; this.update(key, { status: 'loading', progress: 0 });
      void this.load(model, this.controller.signal, progress => this.update(key, { status: 'loading', progress }))
        .then(asset => {
          if (this.closed) disposeModel(asset.scenes);
          else this.update(key, { status: 'ready', asset });
        })
        .catch(() => this.update(key, { status: 'error', message: 'Không tải được mô hình. Tệp có thể không khả dụng hoặc định dạng chưa được hỗ trợ.' }))
        .finally(() => { this.active--; this.pump(); });
    }
  }
}
