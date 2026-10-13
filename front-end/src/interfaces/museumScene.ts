/** Fixed Day 1 shell; shared with placement checks. Camera bounds assume this size. */
export const MUSEUM_ROOM_SIZE = { width: 14, depth: 16, height: 5 } as const;
/** Shared billboard geometry: placement checks must include every orientation. */
export const EXHIBIT_LABEL_SIZE = { width: 1.25, height: 0.3125, depth: 0.75, centerpieceDepth: 1.24 } as const;

/** Local display data, not a public API DTO. Positions use metres, Y up. */
export interface MuseumDisplay {
  id: string;
  title: string;
  description: string;
  transcript?: string | null;
  hotspots?: readonly { id: string; label: string; body: string }[];
  position: [number, number, number];
  shape: 'sphere' | 'torus' | 'cone' | 'cube' | 'icosahedron' | 'cylinder';
  color: string;
  isOutsideRoom?: boolean;
}
