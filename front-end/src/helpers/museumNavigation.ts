import type { Vector3 } from 'three';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { EXHIBIT_PLINTH_SIZE } from '@/interfaces/museumScene';

export const NAVIGATION = {
  walkSpeed: 2, sprintSpeed: 3.6, damping: 12, maxDelta: 0.05,
  eyeHeight: 1.7, bodyRadius: 0.25, wallMargin: 0.45,
  mouseSensitivity: 0.003, touchSensitivity: 0.005, pitchLimit: 1.35,
} as const;
export interface NavigationVector { x: number; y: number }
export interface NavigationLook { yaw: number; pitch: number }
export interface NavigationRoom { width: number; depth: number; height: number }
export interface NavigationCollider { minX: number; maxX: number; minZ: number; maxZ: number }
export interface NavigationInput {
  keys: Set<string>; joystick: NavigationVector; look: NavigationVector;
  wake: () => void; stop: () => void;
}
export function createNavigationInput(): NavigationInput {
  return { keys: new Set(), joystick: { x: 0, y: 0 }, look: { x: 0, y: 0 }, wake: () => {}, stop: () => {} };
}

export function getJoystickVector(dx: number, dy: number, radius: number): NavigationVector {
  const distance = Math.hypot(dx, dy), fraction = Math.min(distance / radius, 1);
  const magnitude = Math.max(0, (fraction - 0.12) / 0.88);
  return distance && magnitude ? { x: dx / distance * magnitude, y: -dy / distance * magnitude } : { x: 0, y: 0 };
}

export function applyLook(look: NavigationLook, dx: number, dy: number, sensitivity: number): void {
  look.yaw -= dx * sensitivity;
  look.pitch = Math.max(-NAVIGATION.pitchLimit, Math.min(NAVIGATION.pitchLimit, look.pitch - dy * sensitivity));
}

/** The normalized GLB envelope (1.8 m) fits inside its 2.44 m plinth.
 * Conservative XZ proxies also protect low bases and failed/loading models. */
export function getDisplayColliders(displays: readonly MuseumDisplay[]): NavigationCollider[] {
  return displays.filter(display => !display.isOutsideRoom).map(display => {
    const isCenterpiece = !!display.model || display.shape === 'torus';
    const halfSize = isCenterpiece ? EXHIBIT_PLINTH_SIZE.centerpieceRadius
      : display.shape === 'sphere' || display.shape === 'cylinder' ? EXHIBIT_PLINTH_SIZE.roundRadius
        : Math.max(EXHIBIT_PLINTH_SIZE.squareWidth / 2, display.shape === 'icosahedron' ? 0.64 : 0);
    const radius = halfSize + NAVIGATION.bodyRadius;
    return { minX: display.position[0] - radius, maxX: display.position[0] + radius,
      minZ: display.position[2] - radius, maxZ: display.position[2] + radius };
  });
}

export function isNavigationPositionSafe(x: number, z: number, room: NavigationRoom, colliders: readonly NavigationCollider[]): boolean {
  return Math.abs(x) <= room.width / 2 - NAVIGATION.wallMargin && Math.abs(z) <= room.depth / 2 - NAVIGATION.wallMargin
    && !colliders.some(box => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
}

function navigationCorners(room: NavigationRoom, colliders: readonly NavigationCollider[]): NavigationVector[] {
  const points: NavigationVector[] = [];
  for (const box of colliders) for (const x of [box.minX - 0.01, box.maxX + 0.01]) for (const y of [box.minZ - 0.01, box.maxZ + 0.01]) {
    if (isNavigationPositionSafe(x, y, room, colliders)) points.push({ x, y });
  }
  return points;
}

export function findSafeNavigationPoint(point: NavigationVector, room: NavigationRoom, colliders: readonly NavigationCollider[]): NavigationVector | null {
  const x = Math.max(-room.width / 2 + NAVIGATION.wallMargin, Math.min(room.width / 2 - NAVIGATION.wallMargin, point.x));
  const y = Math.max(-room.depth / 2 + NAVIGATION.wallMargin, Math.min(room.depth / 2 - NAVIGATION.wallMargin, point.y));
  if (isNavigationPositionSafe(x, y, room, colliders)) return { x, y };
  const candidates = navigationCorners(room, colliders);
  for (const box of colliders) candidates.push({ x: box.minX - 0.01, y }, { x: box.maxX + 0.01, y }, { x, y: box.minZ - 0.01 }, { x, y: box.maxZ + 0.01 });
  return candidates.filter(candidate => isNavigationPositionSafe(candidate.x, candidate.y, room, colliders))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] ?? null;
}

/** Visibility graph around expanded proxy corners, computed only on focus.
 * The slab intersection test rejects every segment through an obstacle. */
export function findNavigationPath(start: NavigationVector, end: NavigationVector, room: NavigationRoom, colliders: readonly NavigationCollider[]): NavigationVector[] | null {
  if (!isNavigationPositionSafe(start.x, start.y, room, colliders) || !isNavigationPositionSafe(end.x, end.y, room, colliders)) return null;
  const clear = (a: NavigationVector, b: NavigationVector) => !colliders.some(box => {
    let enter = 0, exit = 1;
    for (const [origin, direction, low, high] of [[a.x, b.x - a.x, box.minX, box.maxX], [a.y, b.y - a.y, box.minZ, box.maxZ]]) {
      if (Math.abs(direction) < 1e-9) { if (origin <= low || origin >= high) return false; }
      else {
        const first = (low - origin) / direction, second = (high - origin) / direction;
        enter = Math.max(enter, Math.min(first, second)); exit = Math.min(exit, Math.max(first, second));
        if (enter >= exit) return false;
      }
    }
    return enter < exit;
  });
  if (clear(start, end)) return [start, end];
  const nodes = [start, end, ...navigationCorners(room, colliders)];
  const distances = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>(); distances[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
    if (current < 0 || !Number.isFinite(distances[current])) break;
    if (current === 1) {
      const path: NavigationVector[] = [];
      for (let i = 1; i !== -1; i = previous[i]) path.unshift(nodes[i]);
      return path;
    }
    visited.add(current);
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next) || !clear(nodes[current], nodes[next])) continue;
      const distance = distances[current] + Math.hypot(nodes[next].x - nodes[current].x, nodes[next].y - nodes[current].y);
      if (distance < distances[next]) { distances[next] = distance; previous[next] = current; }
    }
  }
  return null;
}

/** Small swept steps prevent tunneling; independent axes permit wall sliding. */
export function moveWithCollisions(position: Vector3, dx: number, dz: number, room: NavigationRoom, colliders: readonly NavigationCollider[]): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.08));
  const stepX = dx / steps, stepZ = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (isNavigationPositionSafe(position.x + stepX, position.z, room, colliders)) position.x += stepX;
    if (isNavigationPositionSafe(position.x, position.z + stepZ, room, colliders)) position.z += stepZ;
  }
}

/** Exact exponential velocity integration keeps acceleration consistent at 30–120 FPS. */
export function stepMovement(position: Vector3, velocity: Vector3, input: NavigationVector, yaw: number, sprint: boolean,
  rawDelta: number, room: NavigationRoom, colliders: readonly NavigationCollider[]): boolean {
  const delta = Math.max(0, Math.min(NAVIGATION.maxDelta, rawDelta));
  const length = Math.max(1, Math.hypot(input.x, input.y));
  const speed = sprint ? NAVIGATION.sprintSpeed : NAVIGATION.walkSpeed;
  const targetX = (Math.cos(yaw) * input.x - Math.sin(yaw) * input.y) / length * speed;
  const targetZ = (-Math.sin(yaw) * input.x - Math.cos(yaw) * input.y) / length * speed;
  const decay = Math.exp(-NAVIGATION.damping * delta), integral = (1 - decay) / NAVIGATION.damping;
  const dx = targetX * delta + (velocity.x - targetX) * integral;
  const dz = targetZ * delta + (velocity.z - targetZ) * integral;
  velocity.x = targetX + (velocity.x - targetX) * decay;
  velocity.z = targetZ + (velocity.z - targetZ) * decay;
  moveWithCollisions(position, dx, dz, room, colliders);
  if (!input.x && !input.y && velocity.lengthSq() < 1e-6) velocity.set(0, 0, 0);
  return !!input.x || !!input.y || velocity.lengthSq() > 0;
}
