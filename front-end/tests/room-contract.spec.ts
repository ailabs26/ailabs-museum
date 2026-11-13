import { expect, test } from '@playwright/test';
import { roomDetailSchema, roomListSchema, roomResponseSchema } from '../src/validations/roomSchema';
import { envelope, exhibit, roomA, roomSummaries } from './fixtures/museumContent';
import { publicRoomWithMediaResponse } from './fixtures/publicRoomWithMedia';

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
    { placeholderColor: 'url(javascript:bad)' }, { placeholderShape: 'unknown' }, { revisionId: 'bad-id' },
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
  expect(roomDetailSchema.safeParse({ ...roomA, exhibits: [{ ...withoutPosition, revisionId: undefined }] }).success).toBe(false);
});

test('public room contract accepts the real Task 9 response with published media', () => {
  const parsed = roomResponseSchema(roomDetailSchema).parse(publicRoomWithMediaResponse);
  const [item] = parsed.data.exhibits;
  expect(item.model?.url).toMatch(/^\/rooms\/e2e-1792074612\/exhibits\/.+\/model\?version=[a-f0-9]{64}$/);
  expect(item.image?.url).toMatch(/^https?:\/\/.+\/media\/uploads\/images\/.+\.png$/);
  expect(item.image?.altText.en).toBeTruthy();
  expect(item.audio?.vi?.subtitle?.mimeType).toBe('text/vtt');
  expect(item.audio?.en?.transcript).toBeTruthy();
  expect(item.i18n?.en.name).toBeTruthy();
  expect(item.hotspots[0].i18n?.en.label).toBeTruthy();
});

test('public room contract rejects unsafe or malformed media', () => {
  const real = publicRoomWithMediaResponse.data;
  const base = real.exhibits[0];
  const media = base.image!;
  const withExhibit = (change: Record<string, unknown>) => ({ ...real, exhibits: [{ ...base, ...change }] });
  for (const change of [
    { image: { ...media, url: '/media/uploads/images/x.png' } },
    { image: { ...media, url: 'javascript:alert(1)' } },
    { image: { ...media, url: 'data:image/png;base64,AAAA' } },
    { image: { ...media, id: 'not-a-uuid' } },
    { image: { ...media, sizeBytes: 0 } },
    { image: { ...media, sizeBytes: 1.5 } },
    { image: { ...media, rights: undefined } },
    { image: { ...media, altText: undefined } },
    { audio: { vi: { ...base.audio!.vi!, audio: null }, en: null } },
    { audio: { vi: undefined, en: null } },
    { scale: { x: 0, y: 1, z: 1 } },
    { rotation: { x: NaN, y: 0, z: 0 } },
  ]) {
    expect(roomDetailSchema.safeParse(withExhibit(change)).success, JSON.stringify(Object.keys(change))).toBe(false);
  }
});

test('public room contract keeps older payloads without i18n/transform valid', () => {
  const real = publicRoomWithMediaResponse.data;
  const legacy = { ...real.exhibits[0], i18n: undefined, rotation: undefined, scale: undefined, model: null, image: null, audio: null };
  expect(roomDetailSchema.safeParse({ ...real, exhibits: [legacy] }).success).toBe(true);
});

test('public GLB descriptors bind the model URL and version to the actual room and exhibit', () => {
  const item = exhibit();
  const hash = 'a'.repeat(64);
  const model = { id: '20000000-0000-4000-8000-000000000001', storageKey: 'models/real.glb', sizeBytes: 100,
    checksumSha256: hash, url: `/rooms/sculpture/exhibits/${item.id}/model?version=${hash}` };
  const parse = (patch: Partial<typeof model>) => roomDetailSchema.safeParse({ ...roomA, exhibits: [{ ...item, model: { ...model, ...patch } }] });
  expect(parse({}).success).toBe(true);
  for (const change of [{ storageKey: '../private.glb' }, { url: 'https://outside.example/model.glb' },
    { checksumSha256: 'b'.repeat(64) }, { url: `/rooms/another/exhibits/${item.id}/model?version=${hash}` }, { sizeBytes: 0 }]) {
    expect(parse(change).success).toBe(false);
  }
});
