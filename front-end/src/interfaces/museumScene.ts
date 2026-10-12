/** Fixed Day 1 shell; shared with placement checks. Camera bounds assume this size. */
export const MUSEUM_ROOM_SIZE = { width: 14, depth: 16, height: 5 } as const;

/** Local display data, not a public API DTO. Positions use metres, Y up. */
export interface MuseumDisplay {
  id: string;
  title: string;
  description: string;
  position: [number, number, number];
  shape: 'sphere' | 'torus' | 'cone' | 'cube' | 'icosahedron' | 'cylinder';
  color: string;
  isOutsideRoom?: boolean;
}
