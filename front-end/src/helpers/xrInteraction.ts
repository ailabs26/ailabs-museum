import { Vector3, type Group, type Object3D, type Raycaster, type Intersection } from 'three';
import { findNavigationPath, type NavigationCollider, type NavigationRoom } from './museumNavigation';

export interface XrTarget {
  point: Vector3;
  distance: number;
  artifactId?: string;
  hotspotId?: string;
  action?: string;
  floor?: boolean;
}
function isVisible(object: Object3D) {
  for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible || node.userData.xrIgnore) return false;
  return true;
}
function targetFor(hit: Intersection): XrTarget | null {
  const target: XrTarget = { point: hit.point, distance: hit.distance };
  for (let node: Object3D | null = hit.object; node; node = node.parent) {
    if (typeof node.userData.xrAction === 'string') { target.action = node.userData.xrAction; return target; }
    if (node.userData.museumFloor === true) { target.floor = true; return target; }
    if (typeof node.userData.hotspotId === 'string') target.hotspotId = node.userData.hotspotId;
    if (typeof node.userData.artifactId === 'string') { target.artifactId = node.userData.artifactId; return target; }
  }
  return null;
}
export function resolveXrIntersection(ray: Raycaster, scene: Object3D): XrTarget | null {
  // Match the existing label visual/picking priority, keeping all other solid
  // geometry as an occluder; never raycast through a wall to the floor.
  const hits = ray.intersectObject(scene, true).filter(hit => isVisible(hit.object));
  hits.sort((a, b) => Number(b.object.userData.museumLabel === true) - Number(a.object.userData.museumLabel === true) || a.distance - b.distance);
  return hits.length ? targetFor(hits[0]) : null;
}
export function canTeleport(head: Vector3, target: Vector3, room: NavigationRoom, colliders: readonly NavigationCollider[]): boolean {
  if (![head.x, head.z, target.x, target.y, target.z].every(Number.isFinite) || Math.abs(target.y) > 0.02
    || Math.hypot(target.x - head.x, target.z - head.z) > 8) return false;
  const path = findNavigationPath({ x: head.x, y: head.z }, { x: target.x, y: target.z }, room, colliders);
  return path?.length === 2;
}
export function teleportOrigin(origin: Group, head: Vector3, target: Vector3) {
  origin.position.x += target.x - head.x; origin.position.z += target.z - head.z; origin.updateMatrixWorld(true);
}
export function snapTurnOrigin(origin: Group, head: Vector3, radians: number) {
  const offset = head.clone().sub(origin.position).applyAxisAngle(new Vector3(0, 1, 0), radians);
  origin.rotation.y += radians;
  origin.position.x = head.x - offset.x; origin.position.z = head.z - offset.z; origin.updateMatrixWorld(true);
}

// WebXR Input Profiles registry: these layouts expose thumbstick x at axis 2.
// Unknown layouts retain native select-based teleport, without guessed indices.
const THUMBSTICK_PROFILES = new Set(['oculus-touch', 'oculus-touch-v2', 'oculus-touch-v3', 'meta-quest-touch-plus', 'meta-quest-touch-pro', 'valve-index', 'microsoft-mixed-reality']);
export function getSnapAxis(source: XRInputSource): number {
  if (source.gamepad?.mapping !== 'xr-standard' || !source.profiles.some(profile => THUMBSTICK_PROFILES.has(profile))) return 0;
  const value = source.gamepad.axes[2];
  return Number.isFinite(value) && Math.abs(value) > 0.65 ? Math.max(-1, Math.min(1, value)) : 0;
}
