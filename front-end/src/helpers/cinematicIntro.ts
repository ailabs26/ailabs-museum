import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { INITIAL_CAMERA_POSITION } from './museumCamera';
import { findNavigationPath, getDisplayColliders } from './museumNavigation';

export type Vec3 = [number, number, number];

/** Thời lượng hiệu ứng camera mở màn (ms). */
export const CINEMATIC_DURATION_MS = 700;

/** Vị trí camera xuất phát: trên cao & lùi xa để lia xuống vị trí ban đầu. */
export const CINEMATIC_START_POSITION: Vec3 = [0, 2.8, 6.6];

/** Skip entrance when published placement obstructs either endpoint or the segment. */
export function getCinematicEntrance(displays: readonly MuseumDisplay[]): { from: Vec3; to: Vec3 } | null {
  const from = CINEMATIC_START_POSITION, to = INITIAL_CAMERA_POSITION;
  const path = findNavigationPath({ x: from[0], y: from[2] }, { x: to[0], y: to[2] }, MUSEUM_ROOM_SIZE, getDisplayColliders(displays));
  return path?.length === 2 ? { from, to } : null;
}

/** Làm mượt chuyển động (ease-in-out) trong khoảng [0, 1]. */
export function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Vị trí camera tại thời điểm `elapsedMs` của hiệu ứng mở màn (ease-in-out).
 * `done` = true khi đã chạy hết thời lượng → bàn giao điều khiển.
 */
export function cinematicPosition(from: Vec3, to: Vec3, elapsedMs: number): { position: Vec3; done: boolean } {
  const t = elapsedMs / CINEMATIC_DURATION_MS;
  return { position: lerpVec3(from, to, smoothstep(t)), done: t >= 1 };
}
