import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { resolveXrIntersection, canTeleport, teleportOrigin, snapTurnOrigin, getSnapAxis } from './xrInteraction';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
it('resolves nested artifact/hotspot identity and respects solid occluders', () => {
  const scene = new Group(), exhibit = new Group(); exhibit.userData.artifactId = 'artifact-7';
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); exhibit.add(mesh); scene.add(exhibit); scene.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 0, 3), new Vector3(0, 0, -1));
  expect(resolveXrIntersection(ray, scene)?.artifactId).toBe('artifact-7');
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); wall.position.z = 2; scene.add(wall); scene.updateMatrixWorld(true);
  expect(resolveXrIntersection(ray, scene)).toBeNull();
  wall.visible = false; expect(resolveXrIntersection(ray, scene)?.artifactId).toBe('artifact-7');
});
it('teleports only along clear floor segments within room and away from plinths', () => {
  const colliders = [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }];
  expect(canTeleport(new Vector3(0, 1.7, 4), new Vector3(2, 0, 4), MUSEUM_ROOM_SIZE, colliders)).toBe(true);
  for (const point of [new Vector3(0, 0, 0), new Vector3(8, 0, 4), new Vector3(0, 0, -4), new Vector3(2, 1, 4)]) {
    expect(canTeleport(new Vector3(0, 1.7, 4), point, MUSEUM_ROOM_SIZE, colliders)).toBe(false);
  }
});
it('moves the origin while retaining headset-relative position and turns around the head', () => {
  const rig = new Group(); rig.position.set(1, 0, 2); const localHead = new Vector3(0.4, 1.6, -0.2);
  rig.updateMatrixWorld(true); const head = rig.localToWorld(localHead.clone());
  teleportOrigin(rig, head, new Vector3(3, 0, 4)); rig.updateMatrixWorld(true);
  const movedHead = rig.localToWorld(localHead.clone()); expect(movedHead.x).toBeCloseTo(3); expect(movedHead.z).toBeCloseTo(4); expect(movedHead.y).toBeCloseTo(1.6);
  snapTurnOrigin(rig, movedHead, Math.PI / 6); rig.updateMatrixWorld(true);
  expect(rig.localToWorld(localHead.clone()).distanceTo(movedHead)).toBeLessThan(1e-6);
});
it('uses only verified xr-standard thumbsticks and ignores absent/unknown axes', () => {
  const source = (profiles: string[], axes?: number[]) => ({ profiles, gamepad: axes && { mapping: 'xr-standard', axes } }) as unknown as XRInputSource;
  expect(getSnapAxis(source(['oculus-touch-v3'], [0, 0, 0.8, 0]))).toBe(0.8);
  expect(getSnapAxis(source(['oculus-touch-v3'], [0, 0, 0.12, 0]))).toBe(0);
  expect(getSnapAxis(source(['unknown'], [0, 0, 1, 0]))).toBe(0);
  expect(getSnapAxis(source(['oculus-touch-v3']))).toBe(0);
});
