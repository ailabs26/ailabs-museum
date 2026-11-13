import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { normalizeModel } from './modelNormalization';

describe('normalizeModel', () => {
  it('grounds and centers nested world bounds without changing source geometry or transforms', () => {
    const root = new Group();
    const nested = new Group();
    nested.position.set(12, -8, 7);
    nested.rotation.z = Math.PI / 2;
    nested.scale.setScalar(4);
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial());
    mesh.position.set(3, 5, -9);
    nested.add(mesh); root.add(nested);
    root.updateMatrixWorld(true);
    const before = root.toJSON();
    const result = normalizeModel(root);
    const pivot = new Group();
    pivot.scale.setScalar(result.scale);
    const offset = new Group(); offset.position.fromArray(result.offset); offset.add(root);
    pivot.add(offset); pivot.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(pivot, true);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(1.8);
    expect(size.y / size.x).toBeCloseTo(0.5);
    expect(size.z / size.x).toBeCloseTo(0.25);
    expect(root.toJSON()).toEqual(before);
  });

  it('rejects empty or out-of-range bounds instead of displaying NaN or gigantic models', () => {
    expect(() => normalizeModel(new Group())).toThrow();
    for (const size of [0, 1e-12, 1e12]) {
      expect(() => normalizeModel(new Mesh(new BoxGeometry(size, size, size)))).toThrow();
    }
  });

  it('honors a verified uniform display scale within the room envelope', () => {
    const model = new Mesh(new BoxGeometry(0.2, 0.4, 0.2));
    expect(normalizeModel(model, 2).size).toEqual([0.4000000059604645, 0.800000011920929, 0.4000000059604645]);
    expect(() => normalizeModel(model, 100)).toThrow();
  });
});
