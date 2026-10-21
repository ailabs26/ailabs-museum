import { describe, expect, it } from 'vitest';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { ExhibitDetail } from '@/services/exhibits.service';
import type { MediaItem } from '@/services/media.service';
import { mergeDraftIntoRoom, toDraftDisplay, toPreviewModel } from './draftPreviewDisplay';

function detail(overrides: Partial<ExhibitDetail['content']> = {}, extra: Partial<ExhibitDetail> = {}): ExhibitDetail {
  return {
    id: 'ex-1',
    roomId: 'room-1',
    status: 'draft',
    visibility: 'visible',
    version: 1,
    displayOrder: 1,
    publishedRevisionId: null,
    currentRevisionNo: 2,
    revisionState: 'draft',
    content: {
      name: { vi: 'Cọc gỗ', en: 'Wooden stake' },
      description: { vi: 'Mô tả', en: '' },
      position: { x: 1, y: 0, z: -2 },
      placeholderShape: 'box',
      placeholderColor: '#123456',
      transcript: { vi: 'Thuyết minh' },
      altText: { vi: 'Ảnh cọc', en: 'Stake photo' },
      ...overrides,
    },
    hotspotsCount: 2,
    createdAt: '',
    updatedAt: '',
    media: null,
    room: { id: 'room-1', name: 'Phòng', slug: 'phong' },
    hotspots: [
      { id: 'h2', label: '{"vi":"Thân","en":"Body"}', body: '{"vi":"N2","en":"B2"}', position: { x: 0, y: 1, z: 0 }, displayOrder: 2 },
      { id: 'h1', label: { vi: 'Đầu', en: '' }, body: { vi: 'N1', en: '' }, position: { x: 0, y: 2, z: 0 }, displayOrder: 1 },
    ],
    revisions: [],
    ...extra,
  } as ExhibitDetail;
}

const model = { id: 'm-1', sizeBytes: 3562172, checksumSha256: 'a'.repeat(64) } as MediaItem;

describe('toDraftDisplay', () => {
  it('maps the draft content in the chosen language with hotspots in display order', () => {
    const display = toDraftDisplay(detail(), null, 'vi');
    expect(display).toMatchObject({
      id: 'ex-1',
      roomId: 'room-1',
      title: 'Cọc gỗ',
      description: 'Mô tả',
      transcript: 'Thuyết minh',
      position: [1, 0, -2],
      shape: 'cube',
      color: '#123456',
    });
    expect(display.hotspots?.map((h) => h.label)).toEqual(['Đầu', 'Thân']);
    expect(display.hotspots?.[0].position).toEqual([0, 2, 0]);
    expect(display.model).toBeUndefined();
  });

  it('shows missing translations instead of falling back to the other language', () => {
    const display = toDraftDisplay(detail({ name: { vi: 'Chỉ tiếng Việt' } }), null, 'en');
    expect(display.title).toBe('(No English text yet)');
    expect(display.description).toBe('');
    expect(display.transcript).toBeNull();
    expect(display.hotspots?.[0].label).toBe('(No English text yet)');
    expect(display.hotspots?.[1].label).toBe('Body');
  });

  it('uses the signed image url with the alt text of the language', () => {
    const withImage = detail({}, { media: { image: { url: 'https://api/media/x.png?sig=1' } } as unknown as ExhibitDetail['media'] });
    expect(toDraftDisplay(withImage, null, 'en').image).toEqual({ url: 'https://api/media/x.png?sig=1', alt: 'Stake photo' });
    expect(toDraftDisplay(detail(), null, 'vi').image).toBeUndefined();
  });

  it('loads the draft model through the authenticated admin content endpoint', () => {
    const display = toDraftDisplay(detail(), model, 'vi');
    expect(display.model).toEqual(toPreviewModel(model));
    expect(display.model?.url).toBe('/admin/media/m-1/content');
    expect(display.model?.checksumSha256).toBe('a'.repeat(64));
  });

  it('flags drafts placed outside the room like the tour does', () => {
    expect(toDraftDisplay(detail({ position: { x: 50, y: 0, z: 0 } }), null, 'vi').isOutsideRoom).toBe(true);
    expect(toDraftDisplay(detail(), null, 'vi').isOutsideRoom).toBe(false);
  });
});

describe('mergeDraftIntoRoom', () => {
  const published = (id: string) => ({ id, title: id, description: '', position: [0, 0, 0], shape: 'cube', color: '#000' }) as MuseumDisplay;

  it('replaces the published version of the same exhibit in place', () => {
    const draft = { ...published('b'), title: 'draft' };
    expect(mergeDraftIntoRoom([published('a'), published('b')], draft).map((d) => d.title)).toEqual(['a', 'draft']);
  });

  it('adds a never-published draft to the room', () => {
    expect(mergeDraftIntoRoom([published('a')], published('new')).map((d) => d.id)).toEqual(['a', 'new']);
  });
});
