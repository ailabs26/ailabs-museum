import type { Vector3 } from 'three';
import { MUSEUM_ROOM_SIZE } from './museumTypes';

/**
 * Hằng số & toán học điều hướng camera cảm ứng — port 1:1 từ `front-end/src/helpers/museumNavigation.ts`,
 * `navigationGestures.ts` và `museumCamera.ts` (MOB-E6-05).
 */
export const NAVIGATION = {
  walkSpeed: 2,
  sprintSpeed: 3.6,
  damping: 12,
  maxDelta: 0.05,
  eyeHeight: 1.7,
  bodyRadius: 0.25,
  wallMargin: 0.45,
  mouseSensitivity: 0.003,
  touchSensitivity: 0.005,
  pinchSensitivity: 0.012,
  pitchLimit: 1.35,
} as const;

export type Vec3Tuple = [number, number, number];
export const INITIAL_CAMERA_POSITION: Vec3Tuple = [0, 2.6, 5.8];
export const INITIAL_CAMERA_TARGET: Vec3Tuple = [0, 1.35, 0];

export interface NavigationVector {
  x: number;
  y: number;
}

export interface NavigationLook {
  yaw: number;
  pitch: number;
}

export interface NavigationRoom {
  width: number;
  depth: number;
  height: number;
}

export interface NavigationCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface NavigationInput {
  joystick: NavigationVector;
  look: NavigationVector;
  dolly: number;
  sprint: boolean;
  wake: () => void;
  stop: () => void;
}

export type CameraAction = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'reset';

export function createNavigationInput(): NavigationInput {
  return {
    joystick: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    dolly: 0,
    sprint: false,
    wake: () => {},
    stop: () => {},
  };
}

/** Giữ nguyên góc nhìn kiến trúc trên màn hình dọc mobile (portrait FOV mở rộng tối đa 82°). */
export function getMuseumFov(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect >= 1 || aspect <= 0) return 60;
  return Math.min(82, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI);
}

/** Ánh xạ cần điều khiển ảo (dead-zone 12%, kẹp bán kính, đảo trục Y màn hình). */
export function getJoystickVector(dx: number, dy: number, radius: number): NavigationVector {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0) {
    return { x: 0, y: 0 };
  }
  const distance = Math.hypot(dx, dy);
  const fraction = Math.min(distance / radius, 1);
  const magnitude = Math.max(0, (fraction - 0.12) / 0.88);
  return distance && magnitude
    ? { x: (dx / distance) * magnitude, y: (-dy / distance) * magnitude }
    : { x: 0, y: 0 };
}

/** Cập nhật góc nhìn yaw/pitch từ thao tác vuốt cảm ứng; kẹp pitch ±1.35 rad và không có roll. */
export function applyLook(
  look: NavigationLook,
  dx: number,
  dy: number,
  sensitivity: number = NAVIGATION.touchSensitivity,
): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(sensitivity)) return;
  look.yaw -= dx * sensitivity;
  look.pitch = Math.max(
    -NAVIGATION.pitchLimit,
    Math.min(NAVIGATION.pitchLimit, look.pitch - dy * sensitivity),
  );
}

/** Tính bước tiến/lùi khi chụm hoặc tách 2 ngón tay (kẹp biên tránh nhảy đột ngột). */
export function computePinchStep(
  previousDistance: number,
  nextDistance: number,
  sensitivity: number = NAVIGATION.pinchSensitivity,
): number {
  if (
    !Number.isFinite(previousDistance) ||
    !Number.isFinite(nextDistance) ||
    previousDistance <= 0 ||
    nextDistance <= 0
  ) {
    return 0;
  }
  const raw = (nextDistance - previousDistance) * sensitivity;
  return Math.max(-0.8, Math.min(0.8, raw));
}

/**
 * Cổng phân biệt thao tác chạm chọn hiện vật với thao tác kéo xoay / pinch 2 ngón.
 * Đồng bộ quy tắc ngưỡng 5 px của web (`NavigationGestures`).
 */
export class NavigationGestures {
  private readonly pointers = new Map<number, { x: number; y: number }>();
  canSelect = true;

  start(id: number, x: number, y: number): void {
    if (this.pointers.size === 0) this.canSelect = true;
    this.pointers.set(id, { x, y });
    if (this.pointers.size > 1) this.canSelect = false;
  }

  move(id: number, x: number, y: number): void {
    const start = this.pointers.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > 5) {
      this.canSelect = false;
    }
  }

  end(id: number): void {
    this.pointers.delete(id);
  }

  cancel(): void {
    this.pointers.clear();
    this.canSelect = false;
  }
}

export type MovePositionHandler = (
  position: Vector3,
  dx: number,
  dz: number,
  room: NavigationRoom,
  colliders: readonly NavigationCollider[],
) => void;

/** Kẹp cơ bản trong tường phòng khi chưa truyền bộ va chạm bục chi tiết. */
export function moveClampedToRoom(
  position: Vector3,
  dx: number,
  dz: number,
  room: NavigationRoom = MUSEUM_ROOM_SIZE,
): void {
  const limitX = Math.max(0, room.width / 2 - NAVIGATION.wallMargin);
  const limitZ = Math.max(0, room.depth / 2 - NAVIGATION.wallMargin);
  position.x = Math.max(-limitX, Math.min(limitX, position.x + dx));
  position.z = Math.max(-limitZ, Math.min(limitZ, position.z + dz));
}

/**
 * Tích phân vận tốc theo hàm mũ chính xác (độc lập tần số quét 30–120 FPS).
 * Khớp công thức của web `stepMovement` để cảm giác di chuyển nhất quán giữa Web và Mobile.
 */
export function stepMovement(
  position: Vector3,
  velocity: Vector3,
  input: NavigationVector,
  yaw: number,
  sprint: boolean,
  rawDelta: number,
  room: NavigationRoom = MUSEUM_ROOM_SIZE,
  colliders: readonly NavigationCollider[] = [],
  moveHandler: MovePositionHandler = moveClampedToRoom,
): boolean {
  const delta = Math.max(0, Math.min(NAVIGATION.maxDelta, rawDelta));
  const length = Math.max(1, Math.hypot(input.x, input.y));
  const speed = sprint ? NAVIGATION.sprintSpeed : NAVIGATION.walkSpeed;
  const targetX = ((Math.cos(yaw) * input.x - Math.sin(yaw) * input.y) / length) * speed;
  const targetZ = ((-Math.sin(yaw) * input.x - Math.cos(yaw) * input.y) / length) * speed;

  const decay = Math.exp(-NAVIGATION.damping * delta);
  const integral = (1 - decay) / NAVIGATION.damping;
  const dx = targetX * delta + (velocity.x - targetX) * integral;
  const dz = targetZ * delta + (velocity.z - targetZ) * integral;

  velocity.x = targetX + (velocity.x - targetX) * decay;
  velocity.z = targetZ + (velocity.z - targetZ) * decay;

  moveHandler(position, dx, dz, room, colliders);

  if (!input.x && !input.y && velocity.lengthSq() < 1e-6) {
    velocity.set(0, 0, 0);
  }
  return Boolean(input.x || input.y || velocity.lengthSq() > 0);
}
