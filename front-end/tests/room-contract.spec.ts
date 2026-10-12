import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';
import { envelope, exhibit, roomA, roomSummaries } from './fixtures/museumContent';

test('public room contract accepts source response and strips entity metadata', () => {
  const rooms = roomListSchema.parse(roomSummaries);
  expect(rooms[0]).toEqual({ id: '00000000-0000-4000-8000-000000000001', slug: 'sculpture', name: 'Không gian của hình khối', description: 'Phòng điêu khắc' });
  expect(rooms[1].description).toBeNull();
  expect(roomDetailSchema.parse(roomA).exhibits).toHaveLength(5);
  expect(roomListSchema.parse([])).toEqual([]);
  expect(roomResponseSchema(roomDetailSchema).safeParse(envelope(roomA)).success).toBe(true);
});

test('public room contract rejects failed envelopes and malformed content', () => {
  const schema = roomResponseSchema(roomDetailSchema);
  for (const payload of [null, roomA, { success: false, data: roomA, message: 'Error' }, envelope(null), envelope({ ...roomA, exhibits: 'invalid' })]) {
    expect(schema.safeParse(payload).success).toBe(false);
  }
  for (const change of [
    { positionX: '1' }, { positionY: Infinity }, { positionZ: NaN },
    { placeholderColor: 'url(javascript:bad)' }, { placeholderShape: 'unknown' },
    { model: { url: 'https://example.org/model.glb' } }, { name: '' }, { id: 'bad-id' }, { displayOrder: -1 },
  ]) {
    expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [{ ...exhibit(), ...change }] }).success).toBe(false);
  }
});

test('public room contract rejects duplicate identities and cross-room exhibits', () => {
  expect(roomListSchema.safeParse([roomSummaries[0], roomSummaries[0]]).success).toBe(false);
  expect(roomListSchema.safeParse([roomSummaries[0], { ...roomSummaries[1], slug: 'sculpture' }]).success).toBe(false);
  expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [exhibit(), exhibit()] }).success).toBe(false);
  expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [exhibit(1, '00000000-0000-4000-8000-000000000002')] }).success).toBe(false);
});

test('public room contract permits absent coordinates but rejects a partial transform', () => {
  const withoutPosition = { ...exhibit(), positionX: undefined, positionY: undefined, positionZ: undefined };
  expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [withoutPosition] }).success).toBe(true);
  expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [{ ...withoutPosition, positionX: 0 }] }).success).toBe(false);
});
