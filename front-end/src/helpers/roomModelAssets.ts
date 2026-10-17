import type { Group, Object3D } from 'three';
import type { ModelNormalization } from './modelNormalization';
import type { PublicModel } from '../validations/roomSchema';
import { disposeModel } from './glbAsset';
import { describeModelFailure } from './modelDiagnostics';
import type { ModelFailure } from './modelDiagnostics';

export interface LoadedModel { scene: Group; scenes: Object3D[]; normalization: ModelNormalization; quarantinedMeshCount?: number }
export const MAX_MODEL_RETRIES = 3;
export type ModelLoadState =
  | { status: 'queued' | 'loading'; progress?: number }
  | { status: 'ready'; asset: LoadedModel }
  | ({ status: 'error'; message: string; attempt: number; retriesRemaining: number; retryAt: number } & ModelFailure);
export type ModelSnapshot = Readonly<Record<string, ModelLoadState>>;
type LoadModel = (model: PublicModel, signal: AbortSignal, progress: (ratio: number) => void) => Promise<LoadedModel>;

/** One owner per open room. Shared bytes/resources, two active downloads, no global cache. */
export class RoomModelAssets {
  snapshot: ModelSnapshot = {};
  private readonly controller = new AbortController();
  private readonly models = new Map<string, PublicModel>();
  private readonly attempts = new Map<string, number>();
  private queue: string[] = [];
  private active = 0;
  private closed = false;
  constructor(private readonly load: LoadModel, private readonly onChange: (value: ModelSnapshot) => void,
    private readonly onFailure?: (key: string, failure: ModelFailure, attempt: number) => void) {}

  start(models: readonly PublicModel[]) {
    if (this.closed || this.models.size) return;
    for (const model of models) this.models.set(model.checksumSha256, model);
    this.queue = [...this.models.keys()];
    this.snapshot = Object.fromEntries(this.queue.map(key => [key, { status: 'queued' }]));
    this.onChange(this.snapshot); this.pump();
  }

  retry(key: string) {
    const state = this.snapshot[key];
    if (this.closed || state?.status !== 'error' || state.retriesRemaining === 0 || Date.now() < state.retryAt) return;
    this.update(key, { status: 'queued' }); this.queue.push(key); this.pump();
  }

  dispose() {
    if (this.closed) return;
    this.closed = true; this.controller.abort(); this.queue = [];
    const assets = Object.values(this.snapshot).flatMap(state => state.status === 'ready' ? state.asset.scenes : []);
    this.snapshot = {}; this.models.clear(); this.attempts.clear();
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
      const attempt = (this.attempts.get(key) ?? 0) + 1; this.attempts.set(key, attempt);
      this.active++; this.update(key, { status: 'loading', progress: 0 });
      void (async () => this.load(model, this.controller.signal, progress => {
        if (this.snapshot[key]?.status === 'loading') this.update(key, { status: 'loading', progress });
      }))()
        .then(asset => {
          if (this.closed) disposeModel(asset.scenes);
          else {
            this.update(key, { status: 'ready', asset });
            if (asset.quarantinedMeshCount) this.onFailure?.(key, { stage: 'mesh', category: 'mesh' }, attempt);
          }
        })
        .catch(error => {
          if (this.closed) return;
          const failure = describeModelFailure(error);
          this.update(key, { status: 'error', message: failure.category === 'format' || failure.category === 'mesh'
            ? 'Tệp mô hình bị hỏng hoặc có định dạng chưa hỗ trợ.' : 'Không tải được mô hình. Vui lòng thử lại.',
          ...failure, attempt, retriesRemaining: Math.max(0, MAX_MODEL_RETRIES + 1 - attempt),
          retryAt: Date.now() + (attempt > 1 ? Math.min(8000, 1000 * 2 ** (attempt - 2)) : 0) });
          this.onFailure?.(key, failure, attempt);
        })
        .finally(() => { this.active--; this.pump(); });
    }
  }
}
