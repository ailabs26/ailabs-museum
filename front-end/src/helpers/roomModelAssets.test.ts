import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { RoomModelAssets } from './roomModelAssets';
import type { LoadedModel } from './roomModelAssets';

const model = (id: string) => ({ id, url: '/rooms/test/exhibits/' + id + '/model?version=' + id.repeat(64),
  storageKey: 'models/' + id + '.glb', checksumSha256: id.repeat(64), sizeBytes: 100 });
const loaded = () => { const scene = new Group(); scene.add(new Mesh(new BoxGeometry())); return { scene, scenes: [scene],
  normalization: { scale: 1, offset: [0, 0, 0], size: [1, 1, 1], center: [0, 0.5, 0], radius: 1 } } as LoadedModel; };

it('limits concurrent loads, deduplicates shared GLBs and retries a failed asset independently', async () => {
  const pending: { id: string; resolve: (value: LoadedModel) => void; reject: (error: Error) => void }[] = [];
  const assets = new RoomModelAssets((descriptor) => new Promise((resolve, reject) => pending.push({ id: descriptor.id, resolve, reject })), () => {});
  assets.start([model('a'), model('a'), model('b'), model('c')]);
  expect(pending.map(p => p.id)).toEqual(['a', 'b']);
  pending[0].resolve(loaded()); await vi.waitFor(() => expect(pending.length).toBe(3));
  pending[1].reject(new Error('network')); await vi.waitFor(() => expect(assets.snapshot['b'.repeat(64)].status).toBe('error'));
  assets.retry('b'.repeat(64)); expect(pending.map(p => p.id)).toEqual(['a', 'b', 'c', 'b']);
  pending[2].resolve(loaded()); pending[3].resolve(loaded());
  await vi.waitFor(() => expect(assets.snapshot['b'.repeat(64)].status).toBe('ready'));
  assets.dispose();
});

it('aborts active work and disposes models which finish parsing after room teardown', async () => {
  let finish!: (value: LoadedModel) => void; let signal!: AbortSignal;
  const value = loaded(); const geometry = (value.scene.children[0] as Mesh).geometry;
  const dispose = vi.spyOn(geometry, 'dispose');
  const assets = new RoomModelAssets((_model, currentSignal) => {
    signal = currentSignal; return new Promise(resolve => { finish = resolve; });
  }, () => {});
  assets.start([model('a'), model('b'), model('c')]);
  assets.dispose(); expect(signal.aborted).toBe(true);
  finish(value); await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
  expect(assets.snapshot).toEqual({});
});

it('late download progress cannot replace a ready model or lose its disposal ownership', async () => {
  let progress!: (ratio: number) => void;
  const value = loaded();
  const dispose = vi.spyOn((value.scene.children[0] as Mesh).geometry, 'dispose');
  const assets = new RoomModelAssets(async (_descriptor, _signal, onProgress) => { progress = onProgress; return value; }, () => {});
  assets.start([model('a')]);
  await vi.waitFor(() => expect(assets.snapshot['a'.repeat(64)].status).toBe('ready'));
  progress(1);
  expect(assets.snapshot['a'.repeat(64)].status).toBe('ready');
  assets.dispose();
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
});
