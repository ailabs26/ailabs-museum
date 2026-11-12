import { describe, expect, it } from 'vitest';
import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { GALLERY_SLOTS, getGalleryColliders, getGallerySlotColliders, getSlotOccupancy, matchGallerySlot, pickFreeSlot, resolveGalleryLayout, snapDisplaysToSlots } from './gallerySlots';
import { CINEMATIC_START_POSITION, getCinematicEntrance } from './cinematicIntro';
import { INITIAL_CAMERA_POSITION } from './museumCamera';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';
import { findNavigationPath, getDisplayColliders, isNavigationPositionSafe } from './museumNavigation';

function at(id: string, position: [number, number, number], extra: Partial<MuseumDisplay> = {}): MuseumDisplay {
  return { id, title: id, description: '', shape: 'cube', color: '#fff', position, ...extra };
}
const onSlot = (id: string, index: number, extra?: Partial<MuseumDisplay>) => at(id, [...GALLERY_SLOTS[index].position], extra);

describe('gallery slot contract', () => {
  it('defines five unique slots with one hero plinth', () => {
    expect(GALLERY_SLOTS.map(slot => slot.id)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
    expect(GALLERY_SLOTS.filter(slot => slot.plinthKind === 'hero').map(slot => slot.id)).toEqual(['S01']);
    expect(new Set(GALLERY_SLOTS.map(slot => slot.position.join())).size).toBe(5);
  });

  it('keeps every plinth, GLB envelope and label inside the room', () => {
    for (const slot of GALLERY_SLOTS) {
      expect(isDisplayOutsideRoom({ position: [...slot.position], shape: 'cube', model: { id: 'm' } as never })).toBe(false);
      expect(isDisplayOutsideRoom({ position: [...slot.position], shape: 'torus' })).toBe(false);
    }
  });

  it('leaves the entrance, spawn and a walkable route to every plinth', () => {
    const colliders = getGallerySlotColliders();
    for (let i = 0; i < colliders.length; i++) for (let j = i + 1; j < colliders.length; j++) {
      const a = colliders[i], b = colliders[j];
      expect(a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ).toBe(true);
    }
    const spawn = { x: INITIAL_CAMERA_POSITION[0], y: INITIAL_CAMERA_POSITION[2] };
    expect(isNavigationPositionSafe(spawn.x, spawn.y, MUSEUM_ROOM_SIZE, colliders)).toBe(true);
    expect(isNavigationPositionSafe(CINEMATIC_START_POSITION[0], CINEMATIC_START_POSITION[2], MUSEUM_ROOM_SIZE, colliders)).toBe(true);
    for (const box of colliders) {
      // Đi được một vòng quanh từng bục: bốn điểm sát bốn cạnh đều tới được từ lối vào.
      const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
      for (const point of [{ x: cx, y: box.maxZ + 0.3 }, { x: cx, y: box.minZ - 0.3 }, { x: box.minX - 0.3, y: cz }, { x: box.maxX + 0.3, y: cz }]) {
        expect(findNavigationPath(spawn, point, MUSEUM_ROOM_SIZE, colliders)).not.toBeNull();
      }
    }
  });
});

describe('matchGallerySlot', () => {
  it('matches within 5 cm and rejects free coordinates', () => {
    expect(matchGallerySlot([0, 0, -2])?.id).toBe('S01');
    expect(matchGallerySlot([-4.26, 0.04, -4.24])?.id).toBe('S02');
    expect(matchGallerySlot([4.3, 0, 2.16])).toBeNull();
    expect(matchGallerySlot([0, 0.2, -2])).toBeNull();
    expect(matchGallerySlot([0, 0, 0])).toBeNull();
    expect(matchGallerySlot([Number.NaN, 0, -2])).toBeNull();
  });
});

describe('resolveGalleryLayout', () => {
  it('keeps all five plinths for an empty room', () => {
    const layout = resolveGalleryLayout([]);
    expect(layout.mode).toBe('slotted');
    expect(layout.mode === 'slotted' && layout.slots.map(item => item.exhibit)).toEqual([null, null, null, null, null]);
  });

  it.each([1, 2, 3, 4, 5])('places %i exhibit(s) on their own slots without moving the others', (count) => {
    // Thứ tự mảng đảo ngược: bục do tọa độ quyết định, không phải displayOrder.
    const displays = Array.from({ length: count }, (_, index) => onSlot(`e${index}`, index)).reverse();
    const layout = resolveGalleryLayout(displays);
    if (layout.mode !== 'slotted') throw new Error('expected slotted');
    expect(layout.slots.map(item => item.slot.id)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
    expect(layout.slots.map(item => item.exhibit?.id ?? null)).toEqual(
      Array.from({ length: 5 }, (_, index) => index < count ? `e${index}` : null));
  });

  it('falls back to legacy without dropping exhibits', () => {
    const free = [onSlot('a', 0), at('b', [1, 0, 1])];
    expect(resolveGalleryLayout(free)).toEqual({ mode: 'legacy', displays: free, reason: 'unmatched-position' });
    const duplicate = [onSlot('a', 1), onSlot('b', 1)];
    expect(resolveGalleryLayout(duplicate)).toEqual({ mode: 'legacy', displays: duplicate, reason: 'duplicate-slot' });
    const many = [...GALLERY_SLOTS.map((_, index) => onSlot(`e${index}`, index)), onSlot('extra', 0)];
    expect(resolveGalleryLayout(many)).toEqual({ mode: 'legacy', displays: many, reason: 'too-many-exhibits' });
  });
});

describe('snapDisplaysToSlots', () => {
  it('centres matched exhibits and leaves legacy rooms untouched', () => {
    expect(snapDisplaysToSlots([at('a', [4.27, 0.01, -4.22])])[0].position).toEqual([4.3, 0, -4.2]);
    const legacy = [at('a', [4.27, 0.01, -4.22]), at('b', [1, 0, 1])];
    expect(snapDisplaysToSlots(legacy)).toEqual(legacy);
  });
});

describe('getGalleryColliders', () => {
  it('blocks all five plinths even when the room is empty', () => {
    const colliders = getGalleryColliders([]);
    expect(colliders).toHaveLength(5);
    for (const slot of GALLERY_SLOTS) expect(isNavigationPositionSafe(slot.position[0], slot.position[2], MUSEUM_ROOM_SIZE, colliders)).toBe(false);
    const hero = colliders[0];
    expect([hero.minX, hero.maxX, hero.minZ, hero.maxZ].map(value => +value.toFixed(6))).toEqual([-1.47, 1.47, -3.47, -0.53]);
  });

  it('uses the slot footprint, not the exhibit shape, in slotted rooms', () => {
    const withModel = [onSlot('a', 1, { model: { id: 'm' } as never })];
    expect(getGalleryColliders(withModel)).toEqual(getGallerySlotColliders());
  });

  it('omits only the framed exhibit plinth and keeps empty ones', () => {
    const displays = [onSlot('a', 0), onSlot('b', 3)];
    const others = getGalleryColliders(displays, 'a');
    expect(others).toHaveLength(4);
    expect(isNavigationPositionSafe(0, -2, MUSEUM_ROOM_SIZE, others)).toBe(true);
  });

  it('keeps legacy colliders byte-for-byte', () => {
    const legacy = [at('a', [0, 0, 0], { shape: 'torus' }), at('b', [3, 0, 3])];
    expect(getGalleryColliders(legacy)).toEqual(getDisplayColliders(legacy));
    expect(getGalleryColliders(legacy, 'a')).toEqual(getDisplayColliders([legacy[1]]));
  });

  it('keeps the cinematic entrance clear in a slotted room', () => {
    expect(findNavigationPath({ x: CINEMATIC_START_POSITION[0], y: CINEMATIC_START_POSITION[2] },
      { x: INITIAL_CAMERA_POSITION[0], y: INITIAL_CAMERA_POSITION[2] }, MUSEUM_ROOM_SIZE, getGalleryColliders([]))).toHaveLength(2);
    expect(getCinematicEntrance([])).not.toBeNull();
  });
});

describe('CMS slot occupancy', () => {
  const slot = (index: number) => ({ x: GALLERY_SLOTS[index].position[0], y: 0, z: GALLERY_SLOTS[index].position[2] });

  it('offers all five slots for a new room, in S01 → S05 order', () => {
    const { bySlot, legacyCount } = getSlotOccupancy([]);
    expect(bySlot.size).toBe(0); expect(legacyCount).toBe(0);
    expect(pickFreeSlot(bySlot)?.id).toBe('S01');
  });

  it('marks occupied slots by exhibit and picks the next free one', () => {
    const { bySlot, legacyCount } = getSlotOccupancy([{ id: 'a', name: 'A', position: slot(0) }, { id: 'b', name: 'B', position: { x: -4.28, y: 0, z: -4.21 } }]);
    expect([...bySlot]).toEqual([['S01', { id: 'a', name: 'A' }], ['S02', { id: 'b', name: 'B' }]]);
    expect(legacyCount).toBe(0);
    expect(pickFreeSlot(bySlot)?.id).toBe('S03');
  });

  it('counts free coordinates, missing positions and duplicates as legacy without taking a slot twice', () => {
    const { bySlot, legacyCount } = getSlotOccupancy([
      { id: 'a', name: 'A', position: slot(0) }, { id: 'dup', name: 'Dup', position: slot(0) },
      { id: 'free', name: 'Free', position: { x: 1, y: 0, z: 1 } }, { id: 'none', name: 'None' },
    ]);
    expect(bySlot.get('S01')).toEqual({ id: 'a', name: 'A' });
    expect(legacyCount).toBe(3);
  });

  it('reports no free slot when all five are taken', () => {
    const { bySlot } = getSlotOccupancy(GALLERY_SLOTS.map((_, index) => ({ id: `e${index}`, name: '', position: slot(index) })));
    expect(pickFreeSlot(bySlot)).toBeNull();
  });
});
