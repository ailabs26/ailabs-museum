import { beforeEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { museumService } from '@/services/museum.service';
import { loadMuseumModel } from './loadMuseumModel';
import { disposeModel } from './glbAsset';

vi.mock('@/services/museum.service', () => ({ museumService: { getModelBinary: vi.fn() } }));
const buffer = new ArrayBuffer(52);
const view = new DataView(buffer); view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, 52, true);
view.setUint32(12, 32, true); view.setUint32(16, 0x4e4f534a, true);
new Uint8Array(buffer, 20).fill(32); new Uint8Array(buffer, 20, 27).set(new TextEncoder().encode('{"asset":{"version":"2.0"}}'));
const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(x => x.toString(16).padStart(2, '0')).join('');
const model = { id: 'm', storageKey: 'models/test.glb', sizeBytes: 52, checksumSha256: hash, url: '/model' };
beforeEach(() => { vi.restoreAllMocks(); vi.mocked(museumService.getModelBinary).mockResolvedValue(buffer); });

it('quarantines a malformed mesh before normalization and retains its disposal ownership', async () => {
  const scene = new Group(); const good = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const bad = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); bad.geometry.attributes.position.setX(0, NaN);
  scene.add(good, bad);
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({ scene, scenes: [scene] } as never);
  const dispose = vi.spyOn(bad.geometry, 'dispose');
  const asset = await loadMuseumModel(model, new AbortController().signal, () => {});
  expect(asset.quarantinedMeshCount).toBe(1); expect(asset.scene.children).toEqual([good]);
  expect(asset.scenes).toContain(bad); expect(dispose).not.toHaveBeenCalled();
  disposeModel(asset.scenes); expect(dispose).toHaveBeenCalledTimes(1);
});

it('classifies parser and corrupt-buffer failures without raw error messages', async () => {
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockRejectedValue(new Error('signed?token=PRIVATE'));
  await expect(loadMuseumModel(model, new AbortController().signal, () => {})).rejects.toMatchObject({ stage: 'parse', category: 'format' });
  vi.mocked(museumService.getModelBinary).mockResolvedValue(new ArrayBuffer(52));
  await expect(loadMuseumModel(model, new AbortController().signal, () => {})).rejects.toMatchObject({ stage: 'validate', category: 'format' });
});

it('disposes a parsed model when cancellation arrives during parse', async () => {
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); scene.add(mesh);
  const dispose = vi.spyOn(mesh.geometry, 'dispose'); const controller = new AbortController();
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => { controller.abort(); return { scene, scenes: [scene] } as never; });
  await expect(loadMuseumModel(model, controller.signal, () => {})).rejects.toThrow();
  expect(dispose).toHaveBeenCalledTimes(1);
});
