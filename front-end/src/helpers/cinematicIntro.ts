export type Vec3 = [number, number, number];

/** Thời lượng hiệu ứng camera mở màn (ms). */
export const CINEMATIC_DURATION_MS = 2000;

/** Vị trí camera xuất phát: trên cao & lùi xa để lia xuống vị trí ban đầu. */
export const CINEMATIC_START_POSITION: Vec3 = [0, 5.2, 9.6];

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
