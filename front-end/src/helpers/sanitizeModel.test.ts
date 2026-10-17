import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, InstancedMesh, Matrix4, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sanitizeModel } from './sanitizeModel';
import { disposeModel } from './glbAsset';
import { normalizeModel } from './modelNormalization';

it.each(['position', 'index', 'material', 'transform', 'attribute'] as const)('quarantines bad %s and preserves valid siblings and resource ownership', (kind) => {
  const scene = new Group(); const good = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const bad = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const dispose = vi.spyOn(bad.geometry, 'dispose');
  if (kind === 'position') bad.geometry.attributes.position.setX(0, NaN);
  if (kind === 'index') bad.geometry.setIndex([0, 1, 99999]);
  if (kind === 'material') bad.material.opacity = NaN;
  if (kind === 'transform') bad.position.x = Infinity;
  if (kind === 'attribute') bad.geometry.setAttribute('normal', new BufferAttribute(new Float32Array([NaN, 0, 0]), 3));
  scene.add(good, bad);
  const result = sanitizeModel(scene);
  expect(result.quarantined).toHaveLength(1);
  expect(scene.children).toContain(good); expect(scene.children).not.toContain(bad);
  expect(normalizeModel(scene).size.every(Number.isFinite)).toBe(true);
  expect(dispose).not.toHaveBeenCalled();
  disposeModel([scene, ...result.quarantined]); expect(dispose).toHaveBeenCalledTimes(1);
});

it('preserves valid multi-material meshes and quarantines a malformed subtree without dropping siblings', () => {
  const scene = new Group(); const branch = new Group(); branch.scale.y = NaN;
  branch.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  const good = new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), new MeshStandardMaterial()]);
  good.geometry.clearGroups(); good.geometry.addGroup(0, 18, 0); good.geometry.addGroup(18, 18, 1);
  scene.add(branch, good);
  expect(sanitizeModel(scene).quarantined).toEqual([branch]);
  expect(scene.children).toEqual([good]);
});

it('rejects an asset with no usable meshes and leaves all resources owned for cleanup', () => {
  const scene = new Group(); const bad = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  bad.geometry.deleteAttribute('position'); scene.add(bad);
  expect(() => sanitizeModel(scene)).toThrow('Mô hình không có mesh hợp lệ');
  expect(scene.children).toEqual([bad]);
});

it('accepts the physical-material Infinity attenuation sentinel used by real specular GLBs', () => {
  const scene = new Group(); const material = new MeshPhysicalMaterial();
  expect(material.attenuationDistance).toBe(Infinity);
  scene.add(new Mesh(new BoxGeometry(), material));
  expect(sanitizeModel(scene).quarantined).toEqual([]);
  material.opacity = Infinity;
  expect(() => sanitizeModel(scene)).toThrow();
});

it('quarantines invalid instance matrices without losing healthy siblings', () => {
  const scene = new Group(); const good = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const invalid = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 1);
  invalid.setMatrixAt(0, new Matrix4().makeTranslation(NaN, 0, 0)); scene.add(good, invalid);
  expect(sanitizeModel(scene).quarantined).toEqual([invalid]);
  expect(normalizeModel(scene).size.every(Number.isFinite)).toBe(true);
});

/** A real GLB with a regular mesh and independently bound skinned sibling. */
async function parsedSkin(jointIndex: number) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const joints = new Uint16Array([jointIndex, 0, 0, 0, jointIndex, 0, 0, 0, jointIndex, 0, 0, 0]);
  const weights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(joints.buffer), Buffer.from(weights.buffer)]);
  const document = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1, 2] }],
    nodes: [{ mesh: 0, name: 'healthy' }, { mesh: 1, skin: 0, name: 'skinned' }, { name: 'bone' }], skins: [{ joints: [2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }, { primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    buffers: [{ byteLength: binary.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }, { buffer: 0, byteOffset: 60, byteLength: 48 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'VEC4' }, { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' }] };
  const json = Buffer.from(JSON.stringify(document)); const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const bytes = Buffer.concat([header, padded, binHeader, binary]);
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

it.each([0, 99])('preserves healthy siblings when a real parsed skin has joint index %i', async (joint) => {
  const scene = await parsedSkin(joint); const skinned = scene.getObjectByName('skinned') as SkinnedMesh;
  const dispose = vi.spyOn(skinned.geometry, 'dispose');
  expect(skinned.isSkinnedMesh).toBe(true);
  const { quarantined } = sanitizeModel(scene);
  expect(quarantined).toHaveLength(joint === 0 ? 0 : 1);
  expect(scene.getObjectByName('healthy')).toBeDefined();
  expect(normalizeModel(scene).size.every(Number.isFinite)).toBe(true);
  expect(dispose).not.toHaveBeenCalled(); disposeModel([scene, ...quarantined]); expect(dispose).toHaveBeenCalledTimes(1);
});

it.each(['inverse', 'bone', 'ancestor', 'binding', 'weights'] as const)('quarantines a malformed skin %s without losing the regular mesh', async (kind) => {
  const scene = await parsedSkin(0); const skinned = scene.getObjectByName('skinned') as SkinnedMesh;
  if (kind === 'inverse') skinned.skeleton.boneInverses[0].elements[0] = NaN;
  if (kind === 'bone') skinned.skeleton.bones[0].position.x = NaN;
  if (kind === 'ancestor') { const parent = new Group(); parent.position.x = NaN; parent.add(skinned.skeleton.bones[0]); scene.add(parent); }
  if (kind === 'binding') skinned.bindMatrix.elements[0] = NaN;
  if (kind === 'weights') skinned.geometry.deleteAttribute('skinWeight');
  const { quarantined } = sanitizeModel(scene);
  expect(quarantined).toContain(skinned);
  expect(scene.getObjectByName('healthy')).toBeDefined();
  expect(normalizeModel(scene).size.every(Number.isFinite)).toBe(true);
  disposeModel([scene, ...quarantined]);
});
