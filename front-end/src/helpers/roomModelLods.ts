import type { PublicModel } from '@/validations/roomSchema';
import { RoomModelAssets } from './roomModelAssets';
import type { LoadedModel, LoadModel, ModelLoadState } from './roomModelAssets';
import type { ModelFailure } from './modelDiagnostics';
import type { ModelLodLevel, ModelLodSet } from './modelLod';

type LodState = ModelLoadState & { level?: ModelLodLevel };
export type LodSnapshot = Readonly<Record<string, LodState>>;
interface ModelFamily {
  source: PublicModel;
  set?: ModelLodSet;
  desired: PublicModel;
  currentKey?: string;
  rendered?: LoadedModel;
  demands: Map<string, ModelLodLevel>;
}

/** Room-scoped selection over the existing checksum owner. Production descriptors keep their legacy path. */
export class RoomModelLods {
  snapshot: LodSnapshot = {};
  private readonly pool: RoomModelAssets;
  private readonly families = new Map<string, ModelFamily>();
  private readonly lastUsed = new Map<string, number>();
  private clock = 0;
  private closed = false;

  constructor(load: LoadModel, private readonly onChange: (value: LodSnapshot) => void,
    onFailure?: (key: string, failure: ModelFailure, attempt: number) => void,
    private readonly sets: readonly ModelLodSet[] = []) {
    this.pool = new RoomModelAssets(load, () => this.refresh(), (key, failure, attempt) => {
      for (const [sourceKey, family] of this.families) {
        if (this.descriptors(family).some(model => model.checksumSha256 === key)) onFailure?.(sourceKey, failure, attempt);
      }
    });
  }

  start(models: readonly PublicModel[]) {
    if (this.closed || this.families.size) return;
    for (const source of models) {
      const set = this.sets.find(value => value.sourceChecksumSha256 === source.checksumSha256);
      const lowest = set?.levels.reduce((left, right) => left.level > right.level ? left : right);
      this.families.set(source.checksumSha256, { source, set, desired: lowest?.model ?? source, demands: new Map() });
    }
    this.pool.start([...this.families.values()].map(family => family.desired));
  }

  select(sourceKey: string, level: ModelLodLevel, consumerId = sourceKey) {
    const family = this.families.get(sourceKey);
    if (this.closed || !family?.set) return;
    family.demands.set(consumerId, level);
    level = Math.min(...family.demands.values()) as ModelLodLevel;
    // A missing level falls back toward full detail, preserving approved viewing limits.
    const available = family.set.levels.filter(value => value.level <= level).sort((left, right) => right.level - left.level)[0];
    const desired = available?.model ?? family.source;
    if (family.desired.checksumSha256 === desired.checksumSha256) return;
    family.desired = desired;
    this.pool.request(desired);
    this.refresh();
  }

  retry(sourceKey: string) {
    const family = this.families.get(sourceKey);
    if (family) this.pool.retry(family.desired.checksumSha256);
  }

  retain(asset: LoadedModel): () => void {
    const release = this.pool.retain(asset);
    return () => { release(); this.sweep(); };
  }

  /** Sweep inactive candidates. Mounted primitives retain their pool resources until detach. */
  sweep() {
    if (this.closed) return;
    const protectedKeys = new Set([...this.families.values()].flatMap(family => [family.currentKey, family.desired.checksumSha256]));
    const inactive = Object.keys(this.pool.snapshot).filter(key => this.pool.snapshot[key].status === 'ready' && !protectedKeys.has(key))
      .sort((left, right) => (this.lastUsed.get(right) ?? 0) - (this.lastUsed.get(left) ?? 0));
    const keptFamilies = new Set<string>();
    let kept = 0;
    for (const key of inactive) {
      const sourceKeys = [...this.families].filter(([, family]) => this.descriptors(family).some(model => model.checksumSha256 === key)).map(([sourceKey]) => sourceKey);
      if (kept < 4 && sourceKeys.every(sourceKey => !keptFamilies.has(sourceKey))) {
        sourceKeys.forEach(sourceKey => keptFamilies.add(sourceKey)); kept++;
      } else {
        if (this.pool.evictReady(key)) this.lastUsed.delete(key);
      }
    }
  }

  dispose() {
    if (this.closed) return;
    this.closed = true; this.pool.dispose(); this.snapshot = {}; this.families.clear(); this.lastUsed.clear();
  }

  private descriptors(family: ModelFamily): PublicModel[] {
    return [family.source, ...(family.set?.levels.map(value => value.model) ?? [])];
  }

  private refresh() {
    if (this.closed) return;
    const next: Record<string, LodState> = {};
    const fallbacks: PublicModel[] = [];
    for (const [sourceKey, family] of this.families) {
      const desiredKey = family.desired.checksumSha256;
      const desired = this.pool.snapshot[desiredKey];
      if (desired?.status === 'ready' && family.currentKey !== desiredKey) {
        family.currentKey = desiredKey;
        this.lastUsed.set(desiredKey, ++this.clock);
      }
      const current = family.currentKey ? this.pool.snapshot[family.currentKey] : undefined;
      if (current?.status === 'ready') {
        const level = family.set?.levels.find(value => value.model.checksumSha256 === family.currentKey)?.level ?? 0;
        if (family.rendered?.scene !== current.asset.scene) {
          family.rendered = family.set ? { ...current.asset, normalization: family.set.normalization } : current.asset;
        }
        const previous = this.snapshot[sourceKey];
        next[sourceKey] = previous?.status === 'ready' && previous.asset === family.rendered && previous.level === level
          ? previous : { ...current, level, asset: family.rendered };
      } else {
        next[sourceKey] = desired ?? { status: 'queued' };
      }
      if (desired?.status === 'error' && family.set && desiredKey !== sourceKey) {
        family.desired = family.source; fallbacks.push(family.source);
      }
    }
    this.snapshot = next;
    this.onChange(next);
    for (const model of fallbacks) this.pool.request(model);
  }
}
