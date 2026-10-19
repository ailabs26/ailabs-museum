import type { Vector3 } from 'three';
import type { MuseumDisplay } from '@/interfaces/museumScene';

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
    const halfSize = isCenterpiece ? 1.22 : display.shape === 'sphere' || display.shape === 'cylinder' ? 0.76 : 0.575;
    const radius = halfSize + NAVIGATION.bodyRadius;
    return { minX: display.position[0] - radius, maxX: display.position[0] + radius,
      minZ: display.position[2] - radius, maxZ: display.position[2] + radius };
  });
}

export function isNavigationPositionSafe(x: number, z: number, room: NavigationRoom, colliders: readonly NavigationCollider[]): boolean {
  return Math.abs(x) <= room.width / 2 - NAVIGATION.wallMargin && Math.abs(z) <= room.depth / 2 - NAVIGATION.wallMargin
    && !colliders.some(box => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
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
