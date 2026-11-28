import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import * as ExpoCrypto from 'expo-crypto';
import { InMemoryGlbCache, type CachedGlbEntry, type GlbCacheAdapter, type GlbCacheStats } from './glbCache';
import { computeSha256Hex, GlbLoadError, loadGlbModel } from './glbLoader';
import type { PublicModel } from './glbSchema';
import { disposeModel } from './glbValidation';

it('passes a byte view to Expo Crypto when Web Crypto is unavailable', async () => {
  const cryptoProperty = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  const nativeDigest = jest.spyOn(ExpoCrypto, 'digest').mockImplementation(async (_algorithm, data) => {
    if (!(data instanceof Uint8Array)) throw new Error('Native digest requires a typed array');
    return Uint8Array.from(crypto.createHash('sha256').update(data).digest()).buffer;
  });
  try {
    const bytes = Uint8Array.of(0, 17, 255);
    await expect(computeSha256Hex(bytes.buffer)).resolves.toBe(
      crypto.createHash('sha256').update(bytes).digest('hex'),
    );
    expect(nativeDigest).toHaveBeenCalledWith(ExpoCrypto.CryptoDigestAlgorithm.SHA256, bytes);
  } finally {
    nativeDigest.mockRestore();
    if (cryptoProperty) Object.defineProperty(globalThis, 'crypto', cryptoProperty);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
});

/**
 * Tạo một tệp GLB 2.0 hợp lệ hoàn chỉnh (1 tam giác có scene, node, mesh, POSITION VEC3)
 * để GLTFLoader của Three.js giải mã thực tế qua HTTP thật.
 */
function createValidTriangleGlb(): Buffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1.5, 0.2]);
  const binary = Buffer.from(positions.buffer);
  const doc = {
    asset: { version: '2.0', generator: 'aura-museum-test' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'bronze-artifact' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1.5, 0.2],
      },
    ],
  };
  const jsonBuf = Buffer.from(JSON.stringify(doc), 'utf8');
  const paddedJsonLen = Math.ceil(jsonBuf.length / 4) * 4;
  const paddedJson = Buffer.alloc(paddedJsonLen, 0x20);
  jsonBuf.copy(paddedJson);

  const paddedBinLen = Math.ceil(binary.length / 4) * 4;
  const paddedBin = Buffer.alloc(paddedBinLen, 0);
  binary.copy(paddedBin);

  const totalLength = 12 + 8 + paddedJsonLen + 8 + paddedBinLen;
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  header.writeUInt32LE(paddedJsonLen, 12);
  header.writeUInt32LE(0x4e4f534a, 16);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinLen, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, paddedJson, binHeader, paddedBin]);
}

function sha256HexNode(buffer: ArrayBuffer): Promise<string> {
  return Promise.resolve(crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex'));
}

/** Adapter cache ghi thẳng ra ổ đĩa thật (thư mục tạm OS) để kiểm thử độ bền qua khởi động lại. */
class NodeDiskGlbCache implements GlbCacheAdapter {
  private readonly accessOrder = new Map<string, number>();
  private tick = 0;

  constructor(private readonly dir: string) {}

  private filePath(checksum: string): string {
    return path.join(this.dir, `${checksum}.glb`);
  }

  async getBuffer(checksum: string): Promise<ArrayBuffer | null> {
    try {
      const data = await fs.readFile(this.filePath(checksum));
      this.accessOrder.set(checksum, ++this.tick);
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } catch {
      return null;
    }
  }

  async putBuffer(checksum: string, buffer: ArrayBuffer): Promise<CachedGlbEntry> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.filePath(checksum);
    await fs.writeFile(file, Buffer.from(buffer));
    const ts = ++this.tick;
    this.accessOrder.set(checksum, ts);
    return {
      checksumSha256: checksum,
      sizeBytes: buffer.byteLength,
      uri: `file://${file}`,
      lastAccessedAt: ts,
    };
  }

  async remove(checksum: string): Promise<void> {
    this.accessOrder.delete(checksum);
    await fs.rm(this.filePath(checksum), { force: true });
  }

  async clear(): Promise<void> {
    this.accessOrder.clear();
    await fs.rm(this.dir, { recursive: true, force: true });
  }

  async getStats(): Promise<GlbCacheStats> {
    const files = await fs.readdir(this.dir).catch(() => []);
    let totalBytes = 0;
    for (const file of files) {
      const stat = await fs.stat(path.join(this.dir, file));
      totalBytes += stat.size;
    }
    return { entryCount: files.length, totalBytes, maxBytes: 10 * 1024 * 1024 };
  }
}

describe('loadGlbModel — Kiểm thử tích hợp HTTP thật + Disk Cache + Xử lý sự cố (MOB-E6-02)', () => {
  const validGlb = createValidTriangleGlb();
  const validSha = crypto.createHash('sha256').update(validGlb).digest('hex');
  const exhibitId = '20000000-0000-4000-8000-000000000002';

  let server: http.Server;
  let baseUrl: string;
  let tempDir: string;
  let requestCount = 0;
  let serverMode: 'ok' | '404' | '429' | '500' | 'tampered' | 'html' = 'ok';

  const makeModel = (): PublicModel => ({
    id: '10000000-0000-4000-8000-000000000001',
    storageKey: 'models/bronze-artifact.glb',
    sizeBytes: validGlb.length,
    checksumSha256: validSha,
    url: `/rooms/dong-son/exhibits/${exhibitId}/model?version=${validSha}`,
  });

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-glb-cache-test-'));
    server = http.createServer((req, res) => {
      requestCount += 1;
      if (serverMode === '404') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
        return;
      }
      if (serverMode === '429') {
        res.writeHead(429, { 'Retry-After': '45' });
        res.end('Too Many Requests');
        return;
      }
      if (serverMode === '500') {
        res.writeHead(500);
        res.end('Internal Error');
        return;
      }
      if (serverMode === 'html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Not a GLB</body></html>');
        return;
      }
      if (serverMode === 'tampered') {
        const corrupted = Buffer.from(validGlb);
        const lastIdx = corrupted.length - 1;
        corrupted[lastIdx] = (corrupted[lastIdx] ?? 0) ^ 0xff;
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': String(corrupted.length),
        });
        res.end(corrupted);
        return;
      }

      if (req.url === `/api/rooms/dong-son/exhibits/${exhibitId}/model?version=${validSha}`) {
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': String(validGlb.length),
          'Cache-Control': 'private, no-store',
        });
        res.end(validGlb);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}/api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    requestCount = 0;
    serverMode = 'ok';
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
  });

  it('parses GLB with a React Native navigator that lacks userAgent', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const nativeNavigator = { product: 'ReactNative' };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nativeNavigator });
    try {
      const asset = await loadGlbModel({
        model: makeModel(),
        apiBaseUrl: baseUrl,
        cache: new InMemoryGlbCache(),
        sha256Impl: sha256HexNode,
      });
      expect(asset.normalization.size[1]).toBeGreaterThan(0);
      expect(nativeNavigator).not.toHaveProperty('userAgent');
      disposeModel(asset.scenes);
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('tải GLB thật qua HTTP ở lần 1 (network), lưu ổ đĩa và hiển thị từ cache ở lần 2 (0 request mạng)', async () => {
    const diskCache = new NodeDiskGlbCache(tempDir);
    const model = makeModel();
    const progressEvents: number[] = [];

    // Lần 1: Cache miss -> tải qua HTTP thật.
    const first = await loadGlbModel({
      model,
      apiBaseUrl: baseUrl,
      cache: diskCache,
      sha256Impl: sha256HexNode,
      onProgress: (ratio) => progressEvents.push(ratio),
    });

    expect(first.source).toBe('network');
    expect(requestCount).toBe(1);
    expect(first.sizeBytes).toBe(validGlb.length);
    expect(first.normalization.size[1]).toBeGreaterThan(0);
    expect(progressEvents.at(-1)).toBe(1);
    disposeModel(first.scenes);

    // Lần 2: Khởi tạo cache adapter mới trỏ cùng thư mục (giả lập mở lại app) -> đọc từ cache, không gọi HTTP.
    const restartedCache = new NodeDiskGlbCache(tempDir);
    const second = await loadGlbModel({
      model,
      apiBaseUrl: baseUrl,
      cache: restartedCache,
      sha256Impl: sha256HexNode,
    });

    expect(second.source).toBe('cache');
    expect(requestCount).toBe(1);
    expect(second.checksumSha256).toBe(validSha);
    disposeModel(second.scenes);
  });

  it('tự phát hiện file cache bị hỏng trên đĩa, xóa bỏ và tự động tải lại bản sạch từ máy chủ', async () => {
    const diskCache = new NodeDiskGlbCache(tempDir);
    const model = makeModel();

    // Ghi dữ liệu hỏng vào đúng đường dẫn cache của checksum.
    await fs.writeFile(path.join(tempDir, `${validSha}.glb`), Buffer.from('corrupt-bytes-on-disk'));

    const recovered = await loadGlbModel({
      model,
      apiBaseUrl: baseUrl,
      cache: diskCache,
      sha256Impl: sha256HexNode,
    });

    expect(recovered.source).toBe('network');
    expect(requestCount).toBe(1);
    disposeModel(recovered.scenes);

    // Sau khi tự hồi phục, lần gọi kế tiếp đọc mượt từ cache.
    const cachedAgain = await loadGlbModel({
      model,
      apiBaseUrl: baseUrl,
      cache: diskCache,
      sha256Impl: sha256HexNode,
    });
    expect(cachedAgain.source).toBe('cache');
    expect(requestCount).toBe(1);
    disposeModel(cachedAgain.scenes);
  });

  it('phân loại chính xác lỗi 404 (gỡ publish), 429 (kèm Retry-After), 500, file bị sửa hash và hủy AbortSignal', async () => {
    const cache = new InMemoryGlbCache();
    const model = makeModel();

    serverMode = '404';
    await expect(
      loadGlbModel({ model, apiBaseUrl: baseUrl, cache, sha256Impl: sha256HexNode }),
    ).rejects.toMatchObject({ category: 'missing', stage: 'download' });

    serverMode = '429';
    await expect(
      loadGlbModel({ model, apiBaseUrl: baseUrl, cache, sha256Impl: sha256HexNode }),
    ).rejects.toMatchObject({ category: 'rate_limit', retryAfterSeconds: 45 });

    serverMode = '500';
    await expect(
      loadGlbModel({ model, apiBaseUrl: baseUrl, cache, sha256Impl: sha256HexNode }),
    ).rejects.toMatchObject({ category: 'server' });

    serverMode = 'tampered';
    await expect(
      loadGlbModel({ model, apiBaseUrl: baseUrl, cache, sha256Impl: sha256HexNode }),
    ).rejects.toMatchObject({ category: 'checksum', stage: 'verify' });

    serverMode = 'html';
    await expect(
      loadGlbModel({ model, apiBaseUrl: baseUrl, cache, sha256Impl: sha256HexNode }),
    ).rejects.toBeInstanceOf(GlbLoadError);

    // Hủy tải ngay bằng AbortSignal.
    const controller = new AbortController();
    controller.abort();
    serverMode = 'ok';
    await expect(
      loadGlbModel({
        model,
        apiBaseUrl: baseUrl,
        cache,
        signal: controller.signal,
        sha256Impl: sha256HexNode,
      }),
    ).rejects.toMatchObject({ category: 'aborted' });
  });

  it('thực thi chính sách dọn cache LRU khi vượt quá giới hạn dung lượng', async () => {
    const cache = new InMemoryGlbCache(1500); // Giới hạn 1500 bytes
    const sha1 = '1'.repeat(64);
    const sha2 = '2'.repeat(64);
    const sha3 = '3'.repeat(64);

    await cache.putBuffer(sha1, new ArrayBuffer(700));
    await cache.putBuffer(sha2, new ArrayBuffer(700));
    // Truy cập sha1 để biến sha2 thành mục ít dùng gần nhất (LRU).
    expect(await cache.getBuffer(sha1)).not.toBeNull();
    // Thêm sha3 (700B) -> tổng 2100B > 1500B -> phải loại sha2, giữ sha1 và sha3.
    await cache.putBuffer(sha3, new ArrayBuffer(700));

    expect(await cache.getBuffer(sha2)).toBeNull();
    expect(await cache.getBuffer(sha1)).not.toBeNull();
    expect(await cache.getBuffer(sha3)).not.toBeNull();
    const stats = await cache.getStats();
    expect(stats.entryCount).toBe(2);
    expect(stats.totalBytes).toBe(1400);
  });
});
