import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { RoomModelLods } from './roomModelLods';
import type { LoadedModel } from './roomModelAssets';
import type { ModelLodSet } from './modelLod';

const source = { id: 'source', checksumSha256: 'a'.repeat(64), storageKey: 'models/source.glb', sizeBytes: 100,
  url: '/rooms/test/exhibits/123/model?version=' + 'a'.repeat(64) };
const normalization: LoadedModel['normalization'] = { scale: 1, offset: [0, 0, 0], size: [1, 1, 1], center: [0, 0.5, 0], radius: 1 };
const variant = (level: 0 | 1 | 2) => ({ ...source, id: String(level), checksumSha256: String(level + 1).repeat(64),
  url: '/rooms/test/exhibits/123/model?version=' + String(level + 1).repeat(64) });
const set: ModelLodSet = { usage: 'fixture', sourceChecksumSha256: source.checksumSha256, normalization,
  thresholds: { lod0Pixels: 480, lod1Pixels: 160, hysteresis: 0.15 },
  levels: [0, 1, 2].map(level => ({ level: level as 0 | 1 | 2, model: variant(level as 0 | 1 | 2) })) };
const loaded = (): LoadedModel => {
  const scene = new Group(); scene.add(new Mesh(new BoxGeometry()));
  return { scene, scenes: [scene], normalization: { ...normalization, scale: 0.9 } };
};

it('starts light, retains the visible scene during upgrade, deduplicates and pins master normalization', async () => {
  const pending: { model: typeof source; resolve: (value: LoadedModel) => void }[] = [];
  const owner = new RoomModelLods((model) => new Promise(resolve => pending.push({ model, resolve })), () => {}, undefined, [set]);
  owner.start([source]);
  expect(pending.map(value => value.model.id)).toEqual(['2']);
  const low = loaded(); pending[0].resolve(low);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256].status).toBe('ready'));
  expect(owner.snapshot[source.checksumSha256]).toMatchObject({ asset: { normalization }, level: 2 });
  const visibleState = owner.snapshot[source.checksumSha256];
  owner.select(source.checksumSha256, 0); owner.select(source.checksumSha256, 0);
  expect(pending.map(value => value.model.id)).toEqual(['2', '0']);
  expect(owner.snapshot[source.checksumSha256]).toMatchObject({ asset: { scene: low.scene } });
  // A queued upgrade must not restart Guided Tour effects that depend on model state identity.
  expect(owner.snapshot[source.checksumSha256]).toBe(visibleState);
  pending[1].resolve(loaded());
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 0 }));
  owner.select(source.checksumSha256, 2);
  expect(pending).toHaveLength(2);
  owner.dispose();
});

it('falls back to original on initial failure, keeps a usable scene on upgrade failure and bounds retries', async () => {
  const onChange = vi.fn();
  const load = vi.fn(async (model: typeof source) => {
    if (model.id !== 'source') throw new Error('network');
    return loaded();
  });
  const owner = new RoomModelLods(load, onChange, undefined, [set]);
  owner.start([source]);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256].status).toBe('ready'));
  owner.select(source.checksumSha256, 0);
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  const changes = onChange.mock.calls.length;
  for (let count = 0; count < 10; count++) owner.select(source.checksumSha256, 0);
  expect(load).toHaveBeenCalledTimes(3);
  expect(onChange).toHaveBeenCalledTimes(changes);
  expect(owner.snapshot[source.checksumSha256].status).toBe('ready');
  owner.dispose();
});

it('uses the original for close inspection when an upgrade fails after a lower level is visible', async () => {
  const requests: string[] = [];
  const owner = new RoomModelLods(async model => {
    requests.push(model.checksumSha256);
    if (model.checksumSha256 === variant(0).checksumSha256) throw new Error('failed high detail');
    return loaded();
  }, () => {}, undefined, [set]);
  owner.start([source]);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 2 }));
  owner.select(source.checksumSha256, 0);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 0 }));
  expect(requests).toEqual([variant(2).checksumSha256, variant(0).checksumSha256, source.checksumSha256]);
  owner.dispose();
});

it('evicts only after the consumer acknowledges detachment, and aborts work on room exit', async () => {
  const values: LoadedModel[] = []; const signals: AbortSignal[] = [];
  const owner = new RoomModelLods(async (_model, signal) => {
    signals.push(signal); const value = loaded(); values.push(value); return value;
  }, () => {}, undefined, [set]);
  owner.start([source]);
  await vi.waitFor(() => expect(values).toHaveLength(1));
  const dispose = vi.spyOn((values[0].scene.children[0] as Mesh).geometry, 'dispose');
  owner.select(source.checksumSha256, 1);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 1 }));
  owner.select(source.checksumSha256, 0);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 0 }));
  expect(dispose).not.toHaveBeenCalled();
  owner.sweep();
  expect(dispose).toHaveBeenCalledTimes(1);
  owner.dispose();
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

it('missing middle level chooses the more detailed available level', async () => {
  const load = vi.fn(async () => loaded());
  const owner = new RoomModelLods(load, () => {}, undefined, [{ ...set, levels: set.levels.filter(value => value.level !== 1) }]);
  owner.start([source]);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 2 }));
  owner.select(source.checksumSha256, 1);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 0 }));
  owner.dispose();
});

it('shares a variant while honoring the closest of multiple instances of the same asset', async () => {
  const load = vi.fn(async () => loaded());
  const owner = new RoomModelLods(load, () => {}, undefined, [set]);
  owner.start([source, source]);
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 2 }));
  owner.select(source.checksumSha256, 0, 'near');
  owner.select(source.checksumSha256, 2, 'far');
  await vi.waitFor(() => expect(owner.snapshot[source.checksumSha256]).toMatchObject({ level: 0 }));
  expect(load).toHaveBeenCalledTimes(2);
  owner.dispose();
});

it('caps inactive cache across families while keeping all displayed shared resources alive', async () => {
  const sources = 'abcdef'.split('').map(letter => ({ ...source, checksumSha256: letter.repeat(64) }));
  const sets = sources.map((model, index) => ({ ...set, sourceChecksumSha256: model.checksumSha256,
    levels: set.levels.map(value => ({ ...value, model: { ...value.model, checksumSha256: `${index}${value.level}`.repeat(32) } })) }));
  const disposed = new Map<string, ReturnType<typeof vi.spyOn>>();
  const owner = new RoomModelLods(async model => {
    const value = loaded(); disposed.set(model.checksumSha256, vi.spyOn((value.scene.children[0] as Mesh).geometry, 'dispose'));
    return value;
  }, () => {}, undefined, sets);
  owner.start(sources);
  await vi.waitFor(() => expect(Object.values(owner.snapshot).filter(value => value.status === 'ready')).toHaveLength(6));
  for (const model of sources) owner.select(model.checksumSha256, 0);
  await vi.waitFor(() => expect(Object.values(owner.snapshot).filter(value => value.level === 0)).toHaveLength(6));
  owner.sweep();
  expect([...disposed.values()].filter(spy => spy.mock.calls.length > 0)).toHaveLength(2);
  for (const value of sets) expect(disposed.get(value.levels[0].model.checksumSha256)).not.toHaveBeenCalled();
  owner.dispose();
  await vi.waitFor(() => expect([...disposed.values()].every(spy => spy.mock.calls.length === 1)).toBe(true));
});
