import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  type Intersection,
} from 'three';
import { GALLERY_PICK_TARGET, pickGalleryTarget } from './galleryPicking';

const size = { width: 200, height: 200 };

function setUpPicking() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 20);
  camera.position.z = 5;
  return {
    scene,
    camera,
    pick: (x = 100, y = 100) => pickGalleryTarget(scene, camera, size, x, y),
  };
}

it('chọn một marker gần nhất, trước exhibit cha và marker cùng ID ở exhibit khác', () => {
  const { scene, pick } = setUpPicking();
  for (const [exhibitId, z] of [
    ['near', 1],
    ['far', 0],
  ] as const) {
    const exhibit = new Group();
    exhibit.position.z = z;
    exhibit.userData = { [GALLERY_PICK_TARGET]: { exhibitId } };
    const marker = new Mesh(new SphereGeometry(0.16, 12, 8), new MeshBasicMaterial());
    marker.userData = { [GALLERY_PICK_TARGET]: { exhibitId, hotspotId: 'shared' } };
    const model = new Mesh(new BoxGeometry(1, 1, 0.1), new MeshBasicMaterial());
    model.position.z = -0.1;
    exhibit.add(marker, model);
    scene.add(exhibit);
  }

  expect(pick()).toEqual({ exhibitId: 'near', hotspotId: 'shared' });
  expect(pick(113, 100)).toEqual({ exhibitId: 'near' });
  expect(pick(200, 200)).toBeUndefined();
});

it('chọn marker qua lỗ của texture MASK và giữ hiện vật tiền cảnh ở vùng đục', () => {
  const { scene, camera } = setUpPicking();
  const pixels = new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]);
  const map = new DataTexture(pixels, 2, 1);
  const material = new MeshBasicMaterial({ map, alphaTest: 0.5 });
  const front = new Mesh(new PlaneGeometry(1.5, 1), material);
  front.position.z = 1;
  front.userData = { [GALLERY_PICK_TARGET]: { exhibitId: 'front' } };
  const marker = new Mesh(new SphereGeometry(0.4), new MeshBasicMaterial());
  marker.userData = { [GALLERY_PICK_TARGET]: { exhibitId: 'rear', hotspotId: 'detail' } };
  scene.add(front, marker);

  // Nearest filtering on the two texels used by this fixture. Native uses the GPU probe.
  const probe = (hit: Intersection) => pixels[hit.uv!.x < 0.5 ? 3 : 7]! / 255 >= material.alphaTest;
  expect(pickGalleryTarget(scene, camera, size, 95, 100, probe)).toEqual({
    exhibitId: 'rear',
    hotspotId: 'detail',
  });
  expect(pickGalleryTarget(scene, camera, size, 105, 100, probe)).toEqual({ exhibitId: 'front' });
});

it('không raycast xuyên bục trống hay geometry trước marker và bỏ qua mesh ẩn', () => {
  const { scene, pick } = setUpPicking();
  const marker = new Mesh(new SphereGeometry(0.16, 12, 8), new MeshBasicMaterial());
  marker.userData = { [GALLERY_PICK_TARGET]: { exhibitId: 'rear', hotspotId: 'detail' } };
  const occluder = new Group();
  occluder.position.z = 1;
  const plinth = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  plinth.userData.galleryPickTarget = { exhibitId: 'foreign', hotspotId: 'untrusted' };
  occluder.add(plinth);
  scene.add(marker, occluder);

  expect(pick()).toBeUndefined();
  occluder.userData = { [GALLERY_PICK_TARGET]: { exhibitId: 'front' } };
  expect(pick()).toEqual({ exhibitId: 'front' });
  plinth.material.visible = false;
  expect(pick()).toEqual({ exhibitId: 'rear', hotspotId: 'detail' });
  plinth.material.visible = true;
  occluder.visible = false;
  expect(pick()).toEqual({ exhibitId: 'rear', hotspotId: 'detail' });
  expect(pick(-1, 0)).toBeUndefined();
});
