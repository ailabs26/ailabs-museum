import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadPreviewModel } from './previewModel';

function stubResponse() {
  const text = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
  const buffer = new ArrayBuffer(52);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, 52, true);
  view.setUint32(12, 32, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).fill(32); new Uint8Array(buffer, 20, text.length).set(text);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer }));
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('disposes CMS preview scenes when aborted during parsing', async () => {
  stubResponse();
  const controller = new AbortController();
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); scene.add(mesh);
  const dispose = vi.spyOn(mesh.geometry, 'dispose');
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async () => {
    controller.abort(); return { scene, scenes: [scene] } as never;
  });
  await expect(loadPreviewModel('/preview.glb', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('disposes an unusable CMS model and reports a safe error message', async () => {
  stubResponse();
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.geometry.attributes.position.setX(0, NaN); scene.add(mesh);
  const dispose = vi.spyOn(mesh.geometry, 'dispose');
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({ scene, scenes: [scene] } as never);
  await expect(loadPreviewModel('/preview.glb?private=token', new AbortController().signal)).rejects.toThrow('Không dựng được mô hình');
  expect(dispose).toHaveBeenCalledTimes(1);
});
