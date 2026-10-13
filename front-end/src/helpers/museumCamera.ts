import type { MuseumDisplay } from '@/interfaces/museumScene';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';

type Point = [number, number, number];
export interface MuseumCameraView { target: Point; position: Point }
export const INITIAL_CAMERA_POSITION: Point = [0, 2.6, 5.8];
export const INITIAL_CAMERA_TARGET: Point = [0, 1.35, 0];
export const CAMERA_MIN_POLAR = 1.25;
export const CAMERA_MAX_POLAR = 1.55;
const WALL_MARGIN = 0.4;

/** A full orbit must fit, so mouse, touch and keyboard share the same envelope. */
export function getOrbitLimit(target: Point): number {
  return Math.min(6, MUSEUM_ROOM_SIZE.width / 2 - WALL_MARGIN - Math.abs(target[0]),
    MUSEUM_ROOM_SIZE.depth / 2 - WALL_MARGIN - Math.abs(target[2]),
    (MUSEUM_ROOM_SIZE.height - WALL_MARGIN - target[1]) / Math.cos(CAMERA_MIN_POLAR));
}
export function getExhibitView(display: MuseumDisplay): MuseumCameraView | null {
  if (display.isOutsideRoom || isDisplayOutsideRoom(display)) return null;
  const [x, y, z] = display.position;
  // Inset the orbit anchor, not the backend exhibit, to leave a usable full orbit.
  const target: Point = [Math.max(-4.1, Math.min(4.1, x)), Math.min(3.2, y + (display.shape === 'torus' ? 2.16 : 1.73)), Math.max(-5.1, Math.min(5.1, z))];
  const radius = Math.min(3.4, getOrbitLimit(target));
  const length = Math.hypot(target[0], target[2]);
  const horizontal = radius * Math.sin(1.35);
  return { target, position: [target[0] + (length ? -target[0] / length : 0) * horizontal,
    target[1] + radius * Math.cos(1.35), target[2] + (length ? -target[2] / length : 1) * horizontal] };
}
