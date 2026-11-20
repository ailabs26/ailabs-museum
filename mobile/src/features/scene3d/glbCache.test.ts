import * as FileSystem from 'expo-file-system';
import {
  ExpoFileSystemGlbCache,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './glbCache';

jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    cacheDirectory: 'file:///mock-cache/',
    EncodingType: { UTF8: 'utf8', Base64: 'base64' },
    __resetMockFs: () => {
      files.clear();
      dirs.clear();
    },
    getInfoAsync: jest.fn(async (uri: string) => ({
      exists: files.has(uri) || dirs.has(uri),
    })),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
      dirs.add(uri);
    }),
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      files.set(uri, content);
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
      const value = files.get(uri);
      if (value === undefined) throw new Error('ENOENT');
      return value;
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      files.delete(uri);
      dirs.delete(uri);
      for (const key of [...files.keys()]) {
        if (key.startsWith(uri)) files.delete(key);
      }
    }),
  };
});

describe('ExpoFileSystemGlbCache (MOB-E6-02)', () => {
  const shaA = 'a'.repeat(64);
  const shaB = 'b'.repeat(64);
  const shaC = 'c'.repeat(64);

  beforeEach(() => {
    (FileSystem as unknown as { __resetMockFs: () => void }).__resetMockFs();
    jest.clearAllMocks();
  });

  it('mã hóa/giải mã Base64 bảo toàn từng byte nhị phân GLB', () => {
    const sample = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0xff, 0x7f]);
    const encoded = arrayBufferToBase64(sample.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(encoded));
    expect(Array.from(decoded)).toEqual(Array.from(sample));
  });

  it('lưu, đọc lại, dọn LRU khi vượt dung lượng và xóa sạch qua expo-file-system', async () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      now += 100;
      return now;
    });

    const cache = new ExpoFileSystemGlbCache({ maxBytes: 1500 });
    expect(await cache.getBuffer(shaA)).toBeNull();

    const bufA = new Uint8Array(700).fill(1).buffer;
    const bufB = new Uint8Array(700).fill(2).buffer;
    const bufC = new Uint8Array(700).fill(3).buffer;

    await cache.putBuffer(shaA, bufA);
    await cache.putBuffer(shaB, bufB);
    // Đọc lại shaA -> cập nhật lastAccessedAt để shaB bị loại trước.
    const readA = await cache.getBuffer(shaA);
    expect(readA?.byteLength).toBe(700);

    await cache.putBuffer(shaC, bufC);
    expect(await cache.getBuffer(shaB)).toBeNull();
    expect(await cache.getBuffer(shaA)).not.toBeNull();
    expect(await cache.getBuffer(shaC)).not.toBeNull();

    const stats = await cache.getStats();
    expect(stats).toEqual({ entryCount: 2, totalBytes: 1400, maxBytes: 1500 });

    await cache.remove(shaA);
    expect(await cache.getBuffer(shaA)).toBeNull();

    await cache.clear();
    expect((await cache.getStats()).entryCount).toBe(0);

    jest.restoreAllMocks();
  });

  it('từ chối khóa checksum không hợp lệ (chống path traversal)', async () => {
    const cache = new ExpoFileSystemGlbCache();
    await expect(cache.getBuffer('../etc/passwd')).rejects.toThrow(/SHA-256/);
    await expect(cache.putBuffer('short', new ArrayBuffer(4))).rejects.toThrow(/SHA-256/);
  });
});
