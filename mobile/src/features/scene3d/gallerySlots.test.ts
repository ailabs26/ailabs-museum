import {
  GALLERY_SLOTS,
  isDisplayOutsideRoom,
  mapRoomDisplays,
  matchGallerySlot,
  resolveGalleryLayout,
  snapDisplaysToSlots,
} from './gallerySlots';
import type { MuseumDisplay, PublicRoomPayload } from './museumTypes';

function makeDisplay(
  id: string,
  position: [number, number, number],
  extra: Partial<MuseumDisplay> = {},
): MuseumDisplay {
  return { id, title: id, description: '', shape: 'cube', color: '#0F766E', position, ...extra };
}

const onSlot = (id: string, index: number, extra?: Partial<MuseumDisplay>) => {
  const slot = GALLERY_SLOTS[index]!;
  return makeDisplay(id, [slot.position[0], slot.position[1], slot.position[2]], extra);
};

describe('gallerySlots — đồng bộ 1:1 với Gallery Template V1 của web (MOB-E6-04)', () => {
  it('định nghĩa 5 bục duy nhất với đúng 1 bục hero (S01) và mọi bục đều nằm trong phòng 14x16x5 m', () => {
    expect(GALLERY_SLOTS.map((slot) => slot.id)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
    expect(GALLERY_SLOTS.filter((slot) => slot.plinthKind === 'hero').map((s) => s.id)).toEqual([
      'S01',
    ]);
    for (const slot of GALLERY_SLOTS) {
      expect(
        isDisplayOutsideRoom({
          position: [slot.position[0], slot.position[1], slot.position[2]],
          shape: 'torus',
        }),
      ).toBe(false);
    }
    expect(isDisplayOutsideRoom({ position: [6.8, 0, 0], shape: 'cube' })).toBe(true);
  });

  it('khớp bục trong sai số 5 cm và từ chối tọa độ tự do hoặc NaN', () => {
    expect(matchGallerySlot([0, 0, -2])?.id).toBe('S01');
    expect(matchGallerySlot([-4.26, 0.04, -4.24])?.id).toBe('S02');
    expect(matchGallerySlot([4.3, 0, 2.16])).toBeNull();
    expect(matchGallerySlot([0, 0.2, -2])).toBeNull();
    expect(matchGallerySlot([Number.NaN, 0, -2])).toBeNull();
  });

  it('đặt đúng 0..5 hiện vật vào bục của chúng độc lập với displayOrder và giữ đủ 5 bục vật lý', () => {
    const empty = resolveGalleryLayout([]);
    expect(empty.mode).toBe('slotted');
    if (empty.mode === 'slotted') {
      expect(empty.slots.map((s) => s.exhibit)).toEqual([null, null, null, null, null]);
    }

    const reversed = [onSlot('e2', 2), onSlot('e0', 0), onSlot('e4', 4)];
    const resolved = resolveGalleryLayout(reversed);
    expect(resolved.mode).toBe('slotted');
    if (resolved.mode === 'slotted') {
      expect(resolved.slots.map((s) => s.exhibit?.id ?? null)).toEqual([
        'e0',
        null,
        'e2',
        null,
        'e4',
      ]);
    }
  });

  it('chuyển sang chế độ legacy khi có tọa độ tự do, trùng bục hoặc > 5 hiện vật mà không bỏ rơi hiện vật nào', () => {
    const unmatched = [onSlot('a', 0), makeDisplay('b', [1, 0, 1])];
    expect(resolveGalleryLayout(unmatched)).toEqual({
      mode: 'legacy',
      displays: unmatched,
      reason: 'unmatched-position',
    });

    const dup = [onSlot('a', 1), onSlot('b', 1)];
    expect(resolveGalleryLayout(dup)).toEqual({
      mode: 'legacy',
      displays: dup,
      reason: 'duplicate-slot',
    });

    const six = [...GALLERY_SLOTS.map((_, i) => onSlot(`e${i}`, i)), onSlot('extra', 0)];
    expect(resolveGalleryLayout(six)).toEqual({
      mode: 'legacy',
      displays: six,
      reason: 'too-many-exhibits',
    });
  });

  it('snap tọa độ lệch ≤ 5 cm về tâm bục và giữ nguyên tọa độ phòng legacy', () => {
    const snapped = snapDisplaysToSlots([makeDisplay('a', [4.27, 0.01, -4.22])]);
    expect(snapped[0]?.position).toEqual([4.3, 0, -4.2]);

    const legacy = [makeDisplay('a', [4.27, 0.01, -4.22]), makeDisplay('b', [1, 0, 1])];
    expect(snapDisplaysToSlots(legacy)).toEqual(legacy);
  });

  it('mapRoomDisplays sắp xếp theo displayOrder, fallback ngôn ngữ về vi và giữ thứ tự hotspot', () => {
    const payload: PublicRoomPayload = {
      id: 'room-1',
      slug: 'dong-son',
      name: 'Phòng Đông Sơn',
      description: null,
      exhibits: [
        {
          id: 'ex-2',
          roomId: 'room-1',
          displayOrder: 2,
          name: 'Bình gốm',
          description: 'Mô tả gốc',
          positionX: -4.28,
          positionY: 0,
          positionZ: -4.21,
          placeholderShape: 'box',
          placeholderColor: '#0F766E',
          i18n: {
            vi: { name: 'Bình gốm cổ', description: 'Gốm thời Lý' },
            en: { name: null, description: null },
          },
        },
        {
          id: 'ex-1',
          roomId: 'room-1',
          displayOrder: 1,
          name: 'Trống đồng',
          description: 'Biểu tượng Đông Sơn',
          positionX: 0.02,
          positionY: 0,
          positionZ: -2.01,
          placeholderShape: 'torus',
          placeholderColor: '#B45309',
          i18n: {
            vi: { name: 'Trống đồng Ngọc Lũ', description: 'Mô tả VI' },
            en: { name: 'Ngoc Lu Bronze Drum', description: 'EN Desc' },
          },
          hotspots: [
            { id: 'h2', label: 'Thân trống', body: 'B2', positionX: 0, positionY: 1, positionZ: 0, displayOrder: 2 },
            { id: 'h1', label: 'Mặt trống', body: 'B1', positionX: 0, positionY: 2, positionZ: 0, displayOrder: 1 },
          ],
        },
      ],
    };

    const mappedEn = mapRoomDisplays(payload, 'en');
    expect(mappedEn.map((d) => d.id)).toEqual(['ex-1', 'ex-2']);
    expect(mappedEn[0]?.title).toBe('Ngoc Lu Bronze Drum');
    expect(mappedEn[0]?.position).toEqual([0, 0, -2]);
    expect(mappedEn[0]?.hotspots?.map((h) => h.id)).toEqual(['h1', 'h2']);
    // ex-2 thiếu bản dịch en -> tự fallback sang tiếng Việt.
    expect(mappedEn[1]?.title).toBe('Bình gốm cổ');
    expect(mappedEn[1]?.shape).toBe('cube');
    expect(mappedEn[1]?.position).toEqual([-4.3, 0, -4.2]);
  });
});
