import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, InstancedMesh, Matrix4 } from 'three';
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
