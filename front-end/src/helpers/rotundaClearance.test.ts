import { describe, expect, it } from 'vitest';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';
import { fitsRotundaClearance, getDisplayPhysicalBounds } from './rotundaClearance';

type Kind = Pick<MuseumDisplay, 'shape' | 'model'>;
const KINDS: Kind[] = [{ shape: 'cube', model: { id: 'glb' } as never }, { shape: 'torus' }, { shape: 'sphere' }, { shape: 'cylinder' }, { shape: 'cube' }, { shape: 'cone' }, { shape: 'icosahedron' }];

/** Mọi tọa độ mà hệ thống cho phép đặt hiện vật trong phòng (lưới 10 cm). */
function legalPlacements(y: number) {
  const placements: Pick<MuseumDisplay, 'position' | 'shape' | 'model'>[] = [];
  for (const kind of KINDS) for (let x = -7; x <= 7.001; x += 0.1) for (let z = -8; z <= 8.001; z += 0.1) {
    const display = { ...kind, position: [+x.toFixed(2), y, +z.toFixed(2)] as [number, number, number] };
    if (!isDisplayOutsideRoom(display)) placements.push(display);
  }
  return placements;
}

describe('Rotunda shell around free-placement (legacy) exhibits', () => {
  it.each([0, 0.5, 1])('every legal placement at y = %s m stays clear of wall, cornice and ceiling decoration', (y) => {
    const placements = legalPlacements(y);
    expect(placements.length).toBeGreaterThan(5000);
    const blocked = placements.filter(display => !fitsRotundaClearance(getDisplayPhysicalBounds(display)));
    expect(blocked.map(display => `${display.model ? 'glb' : display.shape} @ ${display.position.join(',')}`)).toEqual([]);
  });

  it('documents the remaining overlap: GLB raised more than ~1.37 m reaches the ceiling ring', () => {
    // isDisplayOutsideRoom cho phép đỉnh mô hình tới 5 m; trần cũ (sườn 4,77 m) cũng chạm trong trường hợp này.
    const raised = { model: { id: 'glb' } as never, shape: 'cube' as const, position: [0, 1.5, 0] as [number, number, number] };
    expect(isDisplayOutsideRoom(raised)).toBe(false);
    expect(fitsRotundaClearance(getDisplayPhysicalBounds(raised))).toBe(false);
    expect(fitsRotundaClearance(getDisplayPhysicalBounds({ ...raised, position: [0, 1.36, 0] }))).toBe(true);
  });
});
