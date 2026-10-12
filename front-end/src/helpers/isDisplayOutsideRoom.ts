import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import type { MuseumDisplay } from '@/interfaces/museumScene';

/** Includes the plinth/contact patch and sculpture envelope from ExhibitionDisplay. */
export function isDisplayOutsideRoom(display: Pick<MuseumDisplay, 'position' | 'shape'>): boolean {
  const [x, y, z] = display.position;
  const radius = display.shape === 'torus' ? 1.5 : 0.95;
  const height = display.shape === 'torus' ? 3.2 : 2.4;
  return Math.abs(x) + radius > MUSEUM_ROOM_SIZE.width / 2 ||
    Math.abs(z) + radius > MUSEUM_ROOM_SIZE.depth / 2 ||
    y < 0 || y + height > MUSEUM_ROOM_SIZE.height;
}
