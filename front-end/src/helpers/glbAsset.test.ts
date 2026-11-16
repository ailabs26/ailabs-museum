import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { disposeModel, validateGlb } from './glbAsset';

function glb(json: unknown, binary?: Uint8Array) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const size = Math.ceil(text.length / 4) * 4;
  const result = new ArrayBuffer(20 + size + (binary ? 8 + binary.byteLength : 0));
  const view = new DataView(result);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.byteLength, true);
  view.setUint32(12, size, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(result, 20, size).fill(32); new Uint8Array(result, 20, text.length).set(text);
  if (binary) {
    view.setUint32(20 + size, binary.byteLength, true); view.setUint32(24 + size, 0x004e4942, true);
    new Uint8Array(result, 28 + size).set(binary);
  }
  return result;
}

it('accepts self-contained GLB 2 and rejects corrupt headers, external resources and unsupported compression', () => {
  expect(() => validateGlb(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], images: [{ bufferView: 1 }] }))).not.toThrow();
  for (const json of [{ buffers: [{ uri: 'https://evil/model.bin' }] }, { images: [{ uri: 'file.png' }] },
    { extensionsRequired: ['KHR_unknown_extension'] }, { extensionsRequired: ['EXT_meshopt_compression'] },
    { extensionsUsed: ['KHR_texture_basisu'] }]) {
    expect(() => validateGlb(glb(json))).toThrow();
  }
  expect(() => validateGlb(new ArrayBuffer(8))).toThrow();
});

function dracoJson() {
  return {
    asset: { version: '2.0' }, extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'],
    buffers: [{ byteLength: 4 }], bufferViews: [{ buffer: 0, byteLength: 4 }],
    accessors: [{ type: 'VEC3', componentType: 5126, count: 3 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: { POSITION: 0 } } } }] }],
  };
}

it('accepts Draco accessors without raw bufferViews and validates compressed references', () => {
  expect(validateGlb(glb(dracoJson(), new Uint8Array(4)))).toEqual({ usesDraco: true });
  const invalidBuffer = dracoJson(); invalidBuffer.bufferViews[0].byteLength = 8;
  const invalidAccessor = dracoJson(); invalidAccessor.meshes[0].primitives[0].attributes.POSITION = 5;
  const invalidAttribute = dracoJson(); invalidAttribute.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression.attributes.POSITION = -1;
  const excessiveCount = dracoJson(); excessiveCount.accessors[0].count = 10_000_000;
  const excessiveMemory = dracoJson(); excessiveMemory.accessors[0].count = 5_000_000;
  excessiveMemory.accessors.push({ ...excessiveMemory.accessors[0] }, { ...excessiveMemory.accessors[0] });
  Object.assign(excessiveMemory.meshes[0].primitives[0].attributes, { NORMAL: 1, COLOR_0: 2 });
  Object.assign(excessiveMemory.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression.attributes, { NORMAL: 1, COLOR_0: 2 });
  const undeclared = dracoJson(); undeclared.extensionsUsed = [];
  for (const invalid of [invalidBuffer, invalidAccessor, invalidAttribute, excessiveCount, excessiveMemory, undeclared]) {
    expect(() => validateGlb(glb(invalid, new Uint8Array(4)))).toThrow();
  }
  expect(() => validateGlb(glb(dracoJson()))).toThrow();
});

it('rejects malformed, trailing and unaligned binary chunks', () => {
  const valid = glb(dracoJson(), new Uint8Array(4));
  const invalidType = valid.slice(0); new DataView(invalidType).setUint32(invalidType.byteLength - 8, 123, true);
  expect(() => validateGlb(invalidType)).toThrow();
  const trailing = new Uint8Array(valid.byteLength + 4); trailing.set(new Uint8Array(valid));
  new DataView(trailing.buffer).setUint32(8, trailing.byteLength, true);
  expect(() => validateGlb(trailing.buffer)).toThrow();
  expect(() => validateGlb(glb(dracoJson(), new Uint8Array(3)))).toThrow();
});

it('preserves the GLB requirement to ignore well-formed unknown chunks', () => {
  const original = glb({ asset: { version: '2.0' } });
  const buffer = new ArrayBuffer(original.byteLength + 12);
  new Uint8Array(buffer).set(new Uint8Array(original));
  const view = new DataView(buffer);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(original.byteLength, 4, true);
  view.setUint32(original.byteLength + 4, 123, true);
  expect(validateGlb(buffer)).toEqual({ usesDraco: false });
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
