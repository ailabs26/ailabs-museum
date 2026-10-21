import { describe, expect, it } from 'vitest';
import type { RoomDetail } from '@/validations/roomSchema';
import { collectMediaCredits, toMediaCredits } from './mediaCredits';

type PublicExhibit = RoomDetail['exhibits'][number];

const rights = (author: string | null, license: string | null = 'CC BY 4.0', source: string | null = 'Bảo tàng') => ({ source, author, license });
const media = (id: string, r = rights('A')) => ({ id, url: `https://api.test/media/${id}`, mimeType: 'x', sizeBytes: 1, rights: r });

describe('collectMediaCredits', () => {
  it('lists every public media with rights in display order', () => {
    const exhibit = {
      model: { id: 'm', storageKey: 'm.glb', sizeBytes: 1, checksumSha256: 'f'.repeat(64), url: '/rooms/r/exhibits/e/model?version=f', rights: rights('Xưởng 3D') },
      image: { ...media('i', rights('Nhiếp ảnh gia')), altText: { vi: 'Ảnh', en: 'Photo' } },
      audio: {
        vi: { audio: media('av', rights('Người đọc')), subtitle: media('sv', rights(null, 'CC0', null)), transcript: 't' },
        en: { audio: media('ae', rights(null, null, null)), subtitle: null, transcript: null },
      },
    } as unknown as PublicExhibit;
    expect(collectMediaCredits(exhibit)).toEqual([
      { label: 'Mô hình 3D', source: 'Bảo tàng', author: 'Xưởng 3D', license: 'CC BY 4.0' },
      { label: 'Hình ảnh', source: 'Bảo tàng', author: 'Nhiếp ảnh gia', license: 'CC BY 4.0' },
      { label: 'Thuyết minh tiếng Việt', source: 'Bảo tàng', author: 'Người đọc', license: 'CC BY 4.0' },
      { label: 'Phụ đề tiếng Việt', source: null, author: null, license: 'CC0' },
    ]);
  });

  it('returns nothing for an exhibit without media or with an old model payload lacking rights', () => {
    const exhibit = { model: { id: 'm', storageKey: 'm.glb', sizeBytes: 1, checksumSha256: 'f', url: '/x' }, image: null, audio: null } as unknown as PublicExhibit;
    expect(collectMediaCredits(exhibit)).toEqual([]);
  });
});

describe('toMediaCredits', () => {
  it('trims blank values and skips duplicated media ids', () => {
    expect(toMediaCredits([
      { id: 'x', label: 'Phụ đề tiếng Việt', rights: { source: '  ', author: ' Tác giả ', license: null } },
      { id: 'x', label: 'Phụ đề tiếng Anh', rights: rights('Khác') },
    ])).toEqual([{ label: 'Phụ đề tiếng Việt', source: null, author: 'Tác giả', license: null }]);
  });
});
