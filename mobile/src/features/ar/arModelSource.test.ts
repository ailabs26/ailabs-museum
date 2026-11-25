import crypto from 'node:crypto';
import { InMemoryGlbCache } from '@/features/scene3d/glbCache';
import { prepareArGlbSource } from './arModelSource';
import { computeArModelTransform } from './arPlacementMath';

function makeSceneGlb(): ArrayBuffer {
  const positions = Buffer.alloc(36);
  [0, 0, 0, 2, 0, 0, 0, 1, 0].forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3',
      min: [0, 0, 0], max: [2, 1, 0] }],
  }));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const result = Buffer.alloc(12 + 8 + jsonLength + 8 + positions.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonLength, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  json.copy(result, 20);
  result.fill(0x20, 20 + json.length, 20 + jsonLength);
  result.writeUInt32LE(positions.length, 20 + jsonLength);
  result.writeUInt32LE(0x004e4942, 24 + jsonLength);
  positions.copy(result, 28 + jsonLength);
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

it('tính kích thước và vị trí AR từ scene GLB thật trước khi cấp URI cho Viro', async () => {
  const buffer = makeSceneGlb();
  const checksumSha256 = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  const cache = new InMemoryGlbCache();
  await cache.putBuffer(checksumSha256, buffer);
  const id = '10000000-0000-4000-8000-000000000001';
  const result = await prepareArGlbSource({
    model: { id, storageKey: 'models/test.glb', sizeBytes: buffer.byteLength, checksumSha256,
      url: `/rooms/test/exhibits/${id}/model?version=${checksumSha256}` },
    cache,
    apiBaseUrl: 'https://example.com/api',
    sha256Impl: async (input) => crypto.createHash('sha256').update(Buffer.from(input)).digest('hex'),
  });

  expect(result.source).toBe('cache');
  expect(result.normalization.size[0]).toBeCloseTo(1.8);
  expect(result.normalization.offset[0]).toBeCloseTo(-1);
  const fitted = computeArModelTransform(1, result.normalization);
  expect(fitted.scale[0]).toBeCloseTo(0.275);
  expect(fitted.positionOffset[0]).toBeCloseTo(-0.275);
});
