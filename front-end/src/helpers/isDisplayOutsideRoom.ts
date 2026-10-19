import { EXHIBIT_LABEL_SIZE, MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import type { MuseumDisplay } from '@/interfaces/museumScene';

/** Includes the plinth/contact patch and sculpture envelope from ExhibitionDisplay. */
export function isDisplayOutsideRoom(display: Pick<MuseumDisplay, 'position' | 'shape' | 'model'>): boolean {
  const [x, y, z] = display.position;
  const isLarge = !!display.model || display.shape === 'torus';
  const radius = isLarge ? 1.5 : 1;
  const height = display.model ? 3.34 : display.shape === 'torus' ? 3.2 : 2.4;
  const labelDepth = isLarge ? EXHIBIT_LABEL_SIZE.centerpieceDepth : EXHIBIT_LABEL_SIZE.depth;
  const frontExtent = Math.max(radius, labelDepth + EXHIBIT_LABEL_SIZE.width / 2);
  return Math.abs(x) + radius > MUSEUM_ROOM_SIZE.width / 2 ||
    z - radius < -MUSEUM_ROOM_SIZE.depth / 2 || z + frontExtent > MUSEUM_ROOM_SIZE.depth / 2 ||
    y < 0 || y + height > MUSEUM_ROOM_SIZE.height;
}
