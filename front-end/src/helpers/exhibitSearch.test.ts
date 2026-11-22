import { describe, expect, it } from 'vitest';
import { createExhibitSearchIndex, normalizeExhibitSearch, searchExhibits } from './exhibitSearch';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { mapRoomDisplays } from './mapRoomDisplays';
import { roomDetailSchema } from '@/validations/roomSchema';
import { roomA, roomB } from '../../tests/fixtures/museumContent';

const display = (id: string, title: string, description = ''): MuseumDisplay => ({
  id, title, description, position: [0, 0, 0], shape: 'sphere', color: '#fff',
});
const ids = (items: MuseumDisplay[], query: string) => searchExhibits(createExhibitSearchIndex(items), query).map(item => item.id);

describe('room exhibit search', () => {
  it.each([
    ['  BẠCH\tĐẰNG \n', 'bach dang'], ['Trống đồng'.normalize('NFD'), 'trong dong'],
    ['Đđ Dd', 'dd dd'], ['陶器 日本', '陶器 日本'], ['   ', ''],
  ])('normalizes %s', (source, expected) => expect(normalizeExhibitSearch(source)).toBe(expected));

  it('ranks exact, prefix, substring, description, hotspot and deduplicates multiple fields', () => {
    const items = [
      { ...display('hotspot', 'Vase'), hotspots: [{ id: 'h', label: 'Trống đồng', body: '' }] },
      display('description', 'Vase', 'Trống đồng'), display('substring', 'Bộ sưu tập Trống đồng'),
      display('prefix', 'Trống đồng Đông Sơn'), display('exact', 'Trống đồng', 'Trống đồng'),
    ];
    expect(ids(items, 'trong dong')).toEqual(['exact', 'prefix', 'substring', 'description', 'hotspot']);
  });

  it('uses all terms in a field, normalized whitespace, and treats regex characters literally', () => {
    const items = [display('a', 'Bạch Đằng lịch sử'), display('b', 'Đằng sông Bạch'), display('c', '[Bạch] (Đằng)')];
    expect(ids(items, ' BACH   DANG ')).toEqual(['a', 'b', 'c']);
    expect(ids(items, '[bach]')).toEqual(['c']);
    expect(ids(items, '.*')).toEqual([]);
    expect(ids([display('split', 'Bạch', 'Đằng')], 'bach dang')).toEqual([]);
  });

  it('keeps exhibit order for ties and after localization without sorting translated names', () => {
    expect(ids([display('z', 'Trống đồng A'), display('a', 'Trống đồng B')], 'trong dong')).toEqual(['z', 'a']);
    const source = roomDetailSchema.parse({ ...roomA, exhibits: roomA.exhibits.map(e => ({ ...e,
      name: 'Trống đồng', i18n: { vi: { name: null, description: null, transcript: null }, en: { name: 'Bronze drum', description: null, transcript: null } },
    })) });
    expect(ids(mapRoomDisplays(source, 'vi'), 'trong dong')).toEqual(source.exhibits.map(e => e.id));
    expect(ids(mapRoomDisplays(source, 'en'), 'bronze drum')).toEqual(source.exhibits.map(e => e.id));
  });

  it('empty query lists the room; IDs, storage keys and hotspot body are never searchable', () => {
    const item = { ...display('secret-id', 'Vase'), hotspots: [{ id: 'private-key', label: 'Clay', body: 'unindexed-body' }] };
    expect(ids([item], '')).toEqual(['secret-id']);
    for (const q of ['secret-id', 'private-key', 'unindexed-body']) expect(ids([item], q)).toEqual([]);
    expect(ids([], 'clay')).toEqual([]);
  });

  it('rebuilding a validated room index removes stale exhibits and includes outside-room 2D entries', () => {
    const first = mapRoomDisplays(roomDetailSchema.parse(roomA));
    expect(ids(first, 'Bình gốm')).toEqual([]);
    const second = mapRoomDisplays(roomDetailSchema.parse(roomB));
    expect(ids(second, 'hien vat 1')).toEqual([]);
    expect(ids(second, 'binh gom')).toEqual([roomB.exhibits[0].id]);
    expect(ids(first.slice(1), 'Hiện vật 1')).toEqual([]);
    expect(ids([{ ...first[0], isOutsideRoom: true }], 'Hiện vật 1')).toEqual([first[0].id]);
  });
});
