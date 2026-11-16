import { describe, expect, it } from 'vitest';
import type { RoomDetail } from '@/validations/roomSchema';
import { selectHomeHeroSlides } from './homeHeroSlides';

const roomId = '00000000-0000-4000-8000-000000000001';
const exhibitId = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function makeRoom(slug: string, exhibits: Array<{ id: string; displayOrder: number; image?: boolean }>): RoomDetail {
  return {
    id: roomId,
    slug,
    name: 'Phòng',
    description: null,
    exhibits: exhibits.map(({ id, displayOrder, image }) => ({
      id,
      revisionId: '20000000-0000-4000-8000-000000000001',
      roomId,
      displayOrder,
      name: `Hiện vật ${id.slice(-1)}`,
      description: `Mô tả ${id.slice(-1)}`,
      i18n: {
        vi: { name: null, description: null, transcript: null },
        en: { name: `Exhibit ${id.slice(-1)}`, description: `Description ${id.slice(-1)}`, transcript: null },
      },
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      transcript: null,
      placeholderShape: 'box',
      placeholderColor: '#8b7355',
      model: null,
      image: image ? {
        id: '30000000-0000-4000-8000-000000000001',
        url: `https://media.example/${id}.webp`,
        mimeType: 'image/webp',
        sizeBytes: 128,
        rights: { source: null, author: null, license: null },
        altText: { vi: `Ảnh ${id.slice(-1)}`, en: `Image ${id.slice(-1)}` },
      } : null,
      audio: null,
      hotspots: [],
    })),
  };
}

describe('selectHomeHeroSlides', () => {
  it.each([0, 1, 2, 3, 6])('returns up to five poster slides for %i valid images', (count) => {
    const room = makeRoom('hall', Array.from({ length: count }, (_, index) => ({
      id: exhibitId(index + 1), displayOrder: index, image: true,
    })));

    expect(selectHomeHeroSlides([room], 'vi')).toHaveLength(Math.min(count, 5));
  });

  it('uses only published images, sorts by display order then ID, caps at five, and does not mutate API data', () => {
    const room = makeRoom('hall', [
      { id: exhibitId(4), displayOrder: 2, image: true },
      { id: exhibitId(3), displayOrder: 1 },
      { id: exhibitId(2), displayOrder: 2, image: true },
      { id: exhibitId(6), displayOrder: 4, image: true },
      { id: exhibitId(5), displayOrder: 3, image: true },
      { id: exhibitId(1), displayOrder: 1, image: true },
    ]);
    const before = structuredClone(room);

    const slides = selectHomeHeroSlides([room], 'vi');

    expect(slides.map((slide) => slide.exhibitId)).toEqual([exhibitId(1), exhibitId(2), exhibitId(4), exhibitId(5), exhibitId(6)]);
    expect(room).toEqual(before);
  });

  it('localizes text and alt, and builds the detail URL from the same room/exhibit identity', () => {
    const id = exhibitId(1);
    const [slide] = selectHomeHeroSlides([makeRoom('east hall', [{ id, displayOrder: 0, image: true }])], 'en');

    expect(slide).toMatchObject({
      key: `${roomId}:${id}`,
      roomSlug: 'east hall',
      exhibitId: id,
      name: 'Exhibit 1',
      description: 'Description 1',
      imageAlt: 'Image 1',
      detailHref: `/collection/east%20hall/exhibits/${id}`,
    });
  });

  it('flattens rooms in public list order and returns zero slides when none have images', () => {
    const first = makeRoom('first', [{ id: exhibitId(1), displayOrder: 1 }]);
    const second = makeRoom('second', [{ id: exhibitId(2), displayOrder: 1, image: true }]);

    expect(selectHomeHeroSlides([first, second], 'vi').map((slide) => slide.roomSlug)).toEqual(['second']);
    expect(selectHomeHeroSlides([first], 'vi')).toEqual([]);
    expect(selectHomeHeroSlides([], 'vi')).toEqual([]);
  });
});
