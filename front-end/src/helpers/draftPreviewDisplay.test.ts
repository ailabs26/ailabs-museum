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
  it('maps signed audio and subtitle slots only for the chosen locale', () => {
    const input = detail({}, { media: {
      audioVi: { id: 'vi', url: 'https://api/media/vi.mp3?sig=1', mimeType: 'audio/mpeg', sizeBytes: 10 },
      subtitleVi: { id: 'sub', url: 'https://api/media/vi.vtt?sig=2', mimeType: 'text/vtt', sizeBytes: 10 },
    } as unknown as ExhibitDetail['media'] });
    expect(toDraftDisplay(input, null, 'vi').audio?.audio.url).toBe('https://api/media/vi.mp3?sig=1');
    expect(toDraftDisplay(input, null, 'vi').audio?.subtitle?.url).toBe('https://api/media/vi.vtt?sig=2');
    expect(toDraftDisplay(input, null, 'en').audio).toBeNull();
    expect(input.media?.audioVi?.url).toBe('https://api/media/vi.mp3?sig=1');
  });
  it('selects English audio and transcript without mutating Vietnamese media', () => {
    const input = detail({ transcript: { vi: 'Lời Việt', en: 'English narration' } }, { media: {
      audioVi: { id: 'vi', url: 'https://api/media/vi.mp3?sig=1', mimeType: 'audio/mpeg', sizeBytes: 10 },
      audioEn: { id: 'en', url: 'https://api/media/en.mp3?sig=2', mimeType: 'audio/mpeg', sizeBytes: 10 },
    } as unknown as ExhibitDetail['media'] });
    expect(toDraftDisplay(input, null, 'en')).toMatchObject({
      audioLocale: 'en', transcript: 'English narration',
      audio: { audio: { url: 'https://api/media/en.mp3?sig=2' }, subtitle: null, transcript: 'English narration' },
    });
    expect(toDraftDisplay(input, null, 'vi').audio?.audio.url).toBe('https://api/media/vi.mp3?sig=1');
  });
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

  it('credits the media attached to the draft from their rights metadata', () => {
    const withMedia = detail({}, {
      media: {
        model: { id: 'm-1', source: 'Bảo tàng', author: 'Xưởng 3D', license: 'CC BY 4.0' },
        image: { id: 'i-1', source: null, author: null, license: null },
        audioVi: null, audioEn: null, subtitleVi: null, subtitleEn: null,
      } as unknown as ExhibitDetail['media'],
    });
    expect(toDraftDisplay(withMedia, null, 'vi').credits).toEqual([
      { label: 'Mô hình 3D', source: 'Bảo tàng', author: 'Xưởng 3D', license: 'CC BY 4.0' },
    ]);
  });

  it('flags drafts placed outside the room like the tour does', () => {
    expect(toDraftDisplay(detail({ position: { x: 50, y: 0, z: 0 } }), null, 'vi').isOutsideRoom).toBe(true);
    expect(toDraftDisplay(detail(), null, 'vi').isOutsideRoom).toBe(false);
  });
});

describe('mergeDraftIntoRoom', () => {
  const published = (id: string) => ({ id, title: id, description: '', position: [0, 0, 0], shape: 'cube', color: '#000' }) as MuseumDisplay;

  it('replaces the published version of the same exhibit and puts the draft first so its model loads first', () => {
    const draft = { ...published('b'), title: 'draft' };
    expect(mergeDraftIntoRoom([published('a'), published('b'), published('c')], draft).map((d) => d.title)).toEqual(['draft', 'a', 'c']);
  });

  it('adds a never-published draft to the room', () => {
    expect(mergeDraftIntoRoom([published('a')], published('new')).map((d) => d.id)).toEqual(['new', 'a']);
  });
});
