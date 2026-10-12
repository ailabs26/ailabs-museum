import { expect, test } from '@playwright/test';
import { mapRoomDisplays } from '../src/helpers/mapRoomDisplays';
import { roomDetailSchema } from '../src/validations/roomSchema';
import { exhibit, roomA } from './fixtures/museumContent';

test('display mapping preserves backend identity, coordinates, colors and every supported shape', () => {
  const displays = mapRoomDisplays(roomDetailSchema.parse(roomA));
  expect(displays.map((item) => item.shape)).toEqual(['torus', 'sphere', 'cube', 'cone', 'cylinder']);
  expect(displays[0]).toEqual({ id: '10000000-0000-4000-8000-000000000001', title: 'Hiện vật 1', description: 'Mô tả hiện vật 1', position: [0, 0, 0], shape: 'torus', color: '#8b7355' });
  expect(displays[1].position).toEqual([-5.3, 0, -5.1]);
  const offset = mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: [{ ...exhibit(), positionX: 2, positionY: 3, positionZ: -4 }] }));
  expect(offset[0].position).toEqual([2, 3, -4]);
});

test('absent transform layout is deterministic across response order and handles empty or single rooms', () => {
  const items = [1, 2, 3, 4].map((index) => ({ ...exhibit(index), positionX: undefined, positionY: undefined, positionZ: undefined }));
  const forward = mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: items }));
  const reverse = mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: [...items].reverse() }));
  expect(forward.map((item) => item.position)).toEqual([[-5.3, 0, -5.1], [5.3, 0, -5.1], [-5.3, 0, 5.1], [5.3, 0, 5.1]]);
  expect(reverse).toEqual(forward);
  expect(mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: [] }))).toEqual([]);
  expect(mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: [items[0]] }))[0].position).toEqual([0, 0, 0]);
});

test('equal display order uses identity to keep layout stable', () => {
  const items = [2, 1].map((index) => ({ ...exhibit(index), displayOrder: 0, positionX: undefined, positionY: undefined, positionZ: undefined }));
  expect(mapRoomDisplays(roomDetailSchema.parse({ ...roomA, exhibits: items })).map((item) => item.id)).toEqual([
    '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  ]);
});
