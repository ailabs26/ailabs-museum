import type { MuseumDisplay } from '@/interfaces/museumScene';
import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';

type Point = [number, number, number];
export interface MuseumCameraView { target: Point; position: Point }
export interface ModelFocusBounds { center: Point; radius: number }
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
export function getExhibitView(display: MuseumDisplay, bounds?: ModelFocusBounds, aspect = 1.7, fov = 60): MuseumCameraView | null {
  if (display.isOutsideRoom || isDisplayOutsideRoom(display)) return null;
  if (bounds) {
    const target = bounds.center;
    const halfFov = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * aspect));
    const distance = bounds.radius * 1.15 / Math.sin(halfFov);
    const length = Math.hypot(target[0], target[2]);
    const direction: Point = [length ? -target[0] / length : 0, 0.18, length ? -target[2] / length : 1];
    const directionLength = Math.hypot(...direction);
    const position = target.map((value, index) => value + direction[index] / directionLength * distance) as Point;
    position[0] = Math.max(-6.59, Math.min(6.59, position[0]));
    position[1] = Math.max(0.41, Math.min(4.59, position[1]));
    position[2] = Math.max(-7.59, Math.min(7.59, position[2]));
    return { target, position };
  }
  const [x, y, z] = display.position;
  // Inset the orbit anchor, not the backend exhibit, to leave a usable full orbit.
  const target: Point = [Math.max(-4.1, Math.min(4.1, x)), Math.min(3.2, y + (display.shape === 'torus' ? 2.16 : 1.73)), Math.max(-5.1, Math.min(5.1, z))];
  const radius = Math.min(3.4, getOrbitLimit(target));
  const length = Math.hypot(target[0], target[2]);
  const horizontal = radius * Math.sin(1.35);
  return { target, position: [target[0] + (length ? -target[0] / length : 0) * horizontal,
    target[1] + radius * Math.cos(1.35), target[2] + (length ? -target[2] / length : 1) * horizontal] };
}
