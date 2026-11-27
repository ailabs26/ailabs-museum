import {
  Mesh,
  Raycaster,
  Vector2,
  type Camera,
  type Intersection,
  type Material,
  type Object3D,
} from 'three';

export interface GalleryPickTarget {
  exhibitId: string;
  hotspotId?: string;
}

// Use a symbol so GLB node extras cannot declare an application selection target.
export const GALLERY_PICK_TARGET = Symbol('galleryPickTarget');

export type ProbeMaskedHit = (
  hit: Intersection<Mesh>,
  material: Material,
  pointer: Vector2,
) => boolean;

function isVisibleHit(
  hit: Intersection,
  pointer: Vector2,
  probeMaskedHit?: ProbeMaskedHit,
): boolean {
  const { object, face } = hit;
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  if (object instanceof Mesh) {
    const material = Array.isArray(object.material)
      ? object.material[face?.materialIndex ?? 0]
      : object.material;
    if (!material?.visible || (material.transparent && material.opacity === 0)) return false;
    if (material.alphaTest > 0 && face && probeMaskedHit) {
      return probeMaskedHit({ ...hit, object }, material, pointer);
    }
  }
  return true;
}

/** Pick the nearest visible surface, including unselectable occluders such as empty plinths. */
export function pickGalleryTarget(
  scene: Object3D,
  camera: Camera,
  size: { width: number; height: number },
  x: number,
  y: number,
  probeMaskedHit?: ProbeMaskedHit,
): GalleryPickTarget | undefined {
  const { width, height } = size;
  if (
    ![width, height, x, y].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    x > width ||
    y < 0 ||
    y > height
  )
    return;

  scene.updateMatrixWorld();
  camera.updateWorldMatrix(true, false);
  const raycaster = new Raycaster();
  raycaster.layers.mask = camera.layers.mask;
  const pointer = new Vector2((x / width) * 2 - 1, 1 - (y / height) * 2);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster
    .intersectObject(scene, true)
    .find((candidate) => isVisibleHit(candidate, pointer, probeMaskedHit));
  for (let node: Object3D | null = hit?.object ?? null; node; node = node.parent) {
    const data: { [GALLERY_PICK_TARGET]?: GalleryPickTarget } | undefined = node.userData;
    const target = data?.[GALLERY_PICK_TARGET];
    if (target) return target;
  }
}
