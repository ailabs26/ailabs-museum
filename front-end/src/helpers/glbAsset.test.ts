import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { disposeModel, validateGlb } from './glbAsset';

function glb(json: unknown) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const size = Math.ceil(text.length / 4) * 4;
  const result = new ArrayBuffer(20 + size);
  const view = new DataView(result);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.byteLength, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20).fill(32); new Uint8Array(result, 20, text.length).set(text);
  return result;
}

it('accepts self-contained GLB 2 and rejects corrupt headers, external resources and unsupported compression', () => {
  expect(() => validateGlb(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], images: [{ bufferView: 1 }] }))).not.toThrow();
  for (const json of [{ buffers: [{ uri: 'https://evil/model.bin' }] }, { images: [{ uri: 'file.png' }] },
    { extensionsRequired: ['KHR_draco_mesh_compression'] }, { extensionsRequired: ['EXT_meshopt_compression'] }]) {
    expect(() => validateGlb(glb(json))).toThrow();
  }
  expect(() => validateGlb(new ArrayBuffer(8))).toThrow();
});

it('disposes shared geometry, material, texture and bitmap exactly once', () => {
  const geometry = new BoxGeometry(); const material = new MeshStandardMaterial();
  const close = vi.fn(); const texture = new Texture(); texture.source.data = { close }; material.map = texture; material.normalMap = texture;
  const root = new Group(); root.add(new Mesh(geometry, material), new Mesh(geometry, material));
  const disposedGeometry = vi.spyOn(geometry, 'dispose'); const disposedMaterial = vi.spyOn(material, 'dispose');
  const disposedTexture = vi.spyOn(texture, 'dispose');
  disposeModel([root]);
  expect(disposedGeometry).toHaveBeenCalledTimes(1); expect(disposedMaterial).toHaveBeenCalledTimes(1);
  expect(disposedTexture).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
