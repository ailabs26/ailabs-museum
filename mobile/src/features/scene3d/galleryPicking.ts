import { Mesh, Raycaster, Vector2, type Camera, type Intersection, type Object3D } from 'three';

export interface GalleryPickTarget {
  exhibitId: string;
  hotspotId?: string;
}

// Use a symbol so GLB node extras cannot declare an application selection target.
export const GALLERY_PICK_TARGET = Symbol('galleryPickTarget');

function isVisibleHit({ object, face }: Intersection): boolean {
  if (object instanceof Mesh) {
    const material = Array.isArray(object.material)
      ? object.material[face?.materialIndex ?? 0]
      : object.material;
    if (!material?.visible || (material.transparent && material.opacity === 0)) return false;
  }
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
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
  raycaster.setFromCamera(new Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
  const hit = raycaster.intersectObject(scene, true).find(isVisibleHit);
  for (let node: Object3D | null = hit?.object ?? null; node; node = node.parent) {
    const data: { [GALLERY_PICK_TARGET]?: GalleryPickTarget } | undefined = node.userData;
    const target = data?.[GALLERY_PICK_TARGET];
    if (target) return target;
  }
}
