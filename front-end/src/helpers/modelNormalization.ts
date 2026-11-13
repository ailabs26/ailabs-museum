import { Box3, Vector3 } from 'three';
import type { Object3D } from 'three';

export interface ModelNormalization {
  scale: number;
  offset: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
  radius: number;
}

/** Non-destructive wrapper transforms; source geometry/materials stay shared. */
export function normalizeModel(scene: Object3D, verifiedScale?: number): ModelNormalization {
  scene.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(scene, true);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite) || size.length() <= 1e-9) {
    throw new Error('Mô hình có kích thước không hợp lệ.');
  }
  const scale = verifiedScale ?? Math.min(1.8 / (size.x || 1), 2.2 / (size.y || 1), 1.8 / (size.z || 1));
  if (!Number.isFinite(scale) || scale < 1e-6 || scale > 1e6
    || size.x * scale > 1.80001 || size.y * scale > 2.20001 || size.z * scale > 1.80001) {
    throw new Error('Tỷ lệ mô hình vượt phạm vi trưng bày.');
  }
  size.multiplyScalar(scale);
  return {
    scale, offset: [-center.x, -bounds.min.y, -center.z], size: size.toArray(),
    center: [0, size.y / 2, 0], radius: size.length() / 2,
  };
}
