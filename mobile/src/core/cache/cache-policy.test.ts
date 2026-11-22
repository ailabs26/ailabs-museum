import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { CACHE_LIMITS, clearImageCache, selectEvictions } from './cache-policy';
import { FileCache, type CachedFile } from './file-cache';

jest.mock('expo-file-system', () => jest.requireActual('./file-system-mock').fileSystemMock());
jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(async () => true), clearDiskCache: jest.fn(async () => true) },
}));

const fs = FileSystem as unknown as {
  __files: Map<string, string>;
  __setDownload: (fn: (url: string) => { status: number; body?: string }) => void;
};

const entry = (key: string, sizeBytes: number, lastAccessedAt: number): CachedFile => ({
  kind: 'glb',
  key,
  url: `https://cdn.example/${key}.glb`,
  uri: `file:///cache/${key}.glb`,
  sizeBytes,
  lastAccessedAt,
});

describe('selectEvictions (LRU)', () => {
  it('dưới hạn mức -> không xóa gì', () => {
    expect(selectEvictions([entry('a', 40, 1), entry('b', 60, 2)], 100)).toEqual([]);
  });

  it('xóa file ít dùng gần đây nhất trước, vừa đủ để về dưới hạn mức', () => {
    const victims = selectEvictions([entry('new', 50, 30), entry('old', 50, 10), entry('mid', 50, 20)], 100);
    expect(victims.map((v) => v.key)).toEqual(['old']);
  });

  it('không xóa file được giữ, kể cả khi riêng nó vượt hạn mức', () => {
    const victims = selectEvictions([entry('huge', 300, 50), entry('a', 10, 1), entry('b', 10, 2)], 100, ['huge']);
    expect(victims.map((v) => v.key)).toEqual(['a', 'b']);
  });
});

describe('FileCache áp hạn mức sau mỗi lần tải', () => {
  beforeEach(() => fs.__files.clear());

  it('vượt hạn mức -> tự dọn file cũ nhất, giữ file vừa tải và file vừa dùng', async () => {
    let clock = 0;
    fs.__setDownload(() => ({ status: 200, body: 'x'.repeat(40) }));
    const cache = new FileCache({ now: () => ++clock, limits: { glb: 100 } });

    await cache.getOrDownload('https://cdn.example/a.glb', { kind: 'glb', key: 'a' });
    await cache.getOrDownload('https://cdn.example/b.glb', { kind: 'glb', key: 'b' });
    await cache.get('glb', 'a'); // a vừa được dùng lại -> b thành cũ nhất
    await cache.getOrDownload('https://cdn.example/c.glb', { kind: 'glb', key: 'c' });

    expect((await cache.list('glb')).map((e) => e.key).sort()).toEqual(['a', 'c']);
    expect([...fs.__files.keys()].some((k) => k.endsWith('/b.glb'))).toBe(false);
  });

  it('hạn mức theo từng loại: audio đầy không xóa GLB', async () => {
    fs.__setDownload(() => ({ status: 200, body: 'x'.repeat(40) }));
    const cache = new FileCache({ limits: { glb: 1000, audio: 50 } });
    await cache.getOrDownload('https://cdn.example/m.glb', { kind: 'glb', key: 'm' });
    await cache.getOrDownload('https://cdn.example/1.mp3', { kind: 'audio', key: 'a1' });
    await cache.getOrDownload('https://cdn.example/2.mp3', { kind: 'audio', key: 'a2' });
    expect(await cache.getUsage()).toEqual({ glb: { count: 1, bytes: 40 }, audio: { count: 1, bytes: 40 } });
  });

  it('enforceLimit trả số byte đã giải phóng', async () => {
    fs.__setDownload(() => ({ status: 200, body: 'x'.repeat(40) }));
    const big = new FileCache({ limits: { glb: 1000 } });
    await big.getOrDownload('https://cdn.example/a.glb', { kind: 'glb', key: 'a' });
    await big.getOrDownload('https://cdn.example/b.glb', { kind: 'glb', key: 'b' });
    const small = new FileCache({ limits: { glb: 50 } });
    await expect(small.enforceLimit('glb')).resolves.toBe(40);
  });

  it('hạn mức mặc định hợp lý cho thiết bị (GLB > audio)', () => {
    expect(CACHE_LIMITS.glb).toBeGreaterThan(CACHE_LIMITS.audio);
  });
});

describe('clearImageCache', () => {
  it('xóa cả RAM lẫn đĩa của expo-image', async () => {
    await clearImageCache();
    expect(Image.clearMemoryCache).toHaveBeenCalled();
    expect(Image.clearDiskCache).toHaveBeenCalled();
  });
});
