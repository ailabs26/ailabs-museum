import * as FileSystem from 'expo-file-system';
import { FileCache, stableUrl } from './file-cache';

jest.mock('expo-file-system', () => jest.requireActual('./file-system-mock').fileSystemMock());
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  // Băm giả ổn định: đủ để kiểm khóa theo URL (không cần SHA-256 thật).
  digestStringAsync: jest.fn(async (_alg: string, value: string) =>
    Buffer.from(value).toString('hex').slice(-64),
  ),
}));

const fs = FileSystem as unknown as {
  __files: Map<string, string>;
  __downloads: string[];
  __setDownload: (fn: (url: string) => { status: number; body?: string } | Error) => void;
};

const GLB_URL = 'https://cdn.example/models/vase.glb';

describe('FileCache', () => {
  let clock: number;
  let cache: FileCache;

  beforeEach(() => {
    fs.__files.clear();
    fs.__downloads.length = 0;
    fs.__setDownload(() => ({ status: 200, body: 'glb-bytes' }));
    clock = 1_000;
    cache = new FileCache({ now: () => clock });
  });

  it('tải một lần, lần sau đọc từ cache (không gọi mạng)', async () => {
    const first = await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'sha-vase' });
    expect(first).toMatchObject({ fromCache: false, sizeBytes: 9, uri: 'file:///cache/aura-file-cache/glb/sha-vase.glb' });
    expect(fs.__files.get(first.uri)).toBe('glb-bytes');

    const second = await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'sha-vase' });
    expect(second).toMatchObject({ fromCache: true, uri: first.uri });
    expect(fs.__downloads).toEqual([GLB_URL]);
  });

  it('khóa mặc định bỏ query: URL presigned đổi chữ ký vẫn trúng cache', async () => {
    await cache.getOrDownload('https://cdn.example/audio/guide-vi.mp3?X-Amz-Signature=aaa', { kind: 'audio' });
    const again = await cache.getOrDownload('https://cdn.example/audio/guide-vi.mp3?X-Amz-Signature=bbb', { kind: 'audio' });
    expect(again.fromCache).toBe(true);
    expect(again.uri).toMatch(/\/audio\/[0-9a-f]+\.mp3$/);
    expect(stableUrl('https://x/a.mp3?sig=1#t')).toBe('https://x/a.mp3');
  });

  it('nhiều lời gọi cùng lúc chỉ tải một lần', async () => {
    const results = await Promise.all([1, 2, 3].map(() => cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' })));
    expect(fs.__downloads).toHaveLength(1);
    expect(new Set(results.map((r) => r.uri)).size).toBe(1);
    expect(await cache.list()).toHaveLength(1);
  });

  it('cache sống qua lần khởi động lại (index lưu trên đĩa)', async () => {
    await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' });
    const restarted = new FileCache({ now: () => clock });
    await expect(restarted.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' })).resolves.toMatchObject({ fromCache: true });
    expect(fs.__downloads).toHaveLength(1);
  });

  it('get cập nhật thời điểm dùng (cho dọn LRU)', async () => {
    await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' });
    clock = 5_000;
    await cache.get('glb', 'k1');
    expect((await cache.list())[0]?.lastAccessedAt).toBe(5_000);
  });

  it('HTTP lỗi -> ApiException theo status, không để lại file tải dở', async () => {
    fs.__setDownload(() => ({ status: 404, body: 'not found' }));
    await expect(cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' })).rejects.toMatchObject({ status: 404 });
    expect([...fs.__files.keys()].filter((k) => !k.endsWith('index.v1.json'))).toEqual([]);
    expect(await cache.list()).toEqual([]);
  });

  it('mất mạng -> ApiException status 0', async () => {
    fs.__setDownload(() => new Error('Network request failed'));
    await expect(cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' })).rejects.toMatchObject({
      status: 0,
      isNetworkError: true,
    });
  });

  it('file bị hệ điều hành xóa -> coi như chưa cache và tải lại', async () => {
    const first = await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' });
    fs.__files.delete(first.uri);
    await expect(cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'k1' })).resolves.toMatchObject({ fromCache: false });
    expect(fs.__downloads).toHaveLength(2);
  });

  it('remove / clear theo loại / clear toàn bộ; getUsage cộng đúng', async () => {
    await cache.getOrDownload(GLB_URL, { kind: 'glb', key: 'g1' });
    await cache.getOrDownload('https://cdn.example/b.glb', { kind: 'glb', key: 'g2' });
    await cache.getOrDownload('https://cdn.example/a.mp3', { kind: 'audio', key: 'a1' });
    expect(await cache.getUsage()).toEqual({ glb: { count: 2, bytes: 18 }, audio: { count: 1, bytes: 9 } });

    await cache.remove('glb', 'g1');
    expect((await cache.list('glb')).map((e) => e.key)).toEqual(['g2']);

    await cache.clear('audio');
    expect(await cache.getUsage()).toEqual({ glb: { count: 1, bytes: 9 }, audio: { count: 0, bytes: 0 } });
    expect([...fs.__files.keys()].some((k) => k.includes('/audio/'))).toBe(false);

    await cache.clear();
    expect(fs.__files.size).toBe(0);
    expect(await cache.list()).toEqual([]);
  });

  it('từ chối khóa có ký tự đường dẫn (chống ghi ra ngoài thư mục cache)', async () => {
    await expect(cache.getOrDownload(GLB_URL, { kind: 'glb', key: '../../etc/x' })).rejects.toThrow('Khóa cache không hợp lệ');
    expect(fs.__downloads).toEqual([]);
  });

  it('không có file system (web) -> trả URL gốc, không tải', async () => {
    const web = new FileCache({ rootDir: null });
    await expect(web.getOrDownload(GLB_URL, { kind: 'glb' })).resolves.toMatchObject({ uri: GLB_URL, fromCache: false });
    expect(web.enabled).toBe(false);
    expect(fs.__downloads).toEqual([]);
  });
});
