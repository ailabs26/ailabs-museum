/** Local display data, not a public API DTO. Positions use metres, Y up. */
export interface MuseumDisplay {
  id: string;
  title: string;
  description: string;
  position: [number, number, number];
  shape: 'sphere' | 'torus' | 'cone' | 'cube' | 'icosahedron';
  color: string;
}
