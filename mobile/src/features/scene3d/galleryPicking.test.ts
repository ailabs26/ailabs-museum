import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
} from 'three';
import { GALLERY_PICK_TARGET, pickGalleryTarget } from './galleryPicking';

const size = { width: 200, height: 200 };

function setUpPicking() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 20);
  camera.position.z = 5;
  return {
    scene,
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
