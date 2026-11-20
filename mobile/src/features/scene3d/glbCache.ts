import * as FileSystem from 'expo-file-system';

/**
 * Hợp đồng cache tệp nhị phân GLB (MOB-E6-02).
 * Tách interface để có thể cắm trực tiếp dịch vụ File Cache chung `MOB-E3-05` của TV2 khi sẵn sàng.
 */
export interface CachedGlbEntry {
  checksumSha256: string;
  sizeBytes: number;
  uri: string;
  lastAccessedAt: number;
}

export interface GlbCacheStats {
  entryCount: number;
  totalBytes: number;
  maxBytes: number;
}

export interface GlbCacheAdapter {
  /** Đọc buffer GLB từ cache theo SHA-256 (trả null nếu chưa có hoặc đã bị xóa). */
  getBuffer(checksumSha256: string): Promise<ArrayBuffer | null>;
  /** Ghi buffer GLB vào cache và tự động giải phóng các mục cũ nhất nếu vượt ngưỡng dung lượng. */
  putBuffer(checksumSha256: string, buffer: ArrayBuffer): Promise<CachedGlbEntry>;
  /** Xóa một mục cache cụ thể (ví dụ phát hiện file hỏng / hiện vật gỡ publish). */
  remove(checksumSha256: string): Promise<void>;
  /** Xóa toàn bộ thư mục cache GLB. */
  clear(): Promise<void>;
  /** Thống kê dung lượng cache hiện tại. */
  getStats(): Promise<GlbCacheStats>;
}

const DEFAULT_MAX_CACHE_BYTES = 150 * 1024 * 1024; // 150 MB
const INDEX_FILENAME = 'index.v1.json';
const SHA256_REGEX = /^[a-f0-9]{64}$/;

interface CacheIndexFile {
  version: 1;
  entries: Record<string, CachedGlbEntry>;
}

function assertValidChecksum(checksumSha256: string): void {
  if (!SHA256_REGEX.test(checksumSha256)) {
    throw new Error('Checksum SHA-256 không hợp lệ cho khóa cache GLB.');
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Triển khai cache GLB trên thiết bị bằng `expo-file-system` kèm chính sách dọn LRU.
 * Khóa file theo SHA-256 giúp vô hiệu hóa tự động khi hiện vật xuất bản bản mới.
 */
export class ExpoFileSystemGlbCache implements GlbCacheAdapter {
  private readonly cacheDir: string;
  private readonly indexPath: string;
  private readonly maxBytes: number;

  constructor(options: { baseDir?: string; maxBytes?: number } = {}) {
    const root = options.baseDir ?? FileSystem.cacheDirectory ?? '';
    const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
    this.cacheDir = `${normalizedRoot}aura-glb-cache/`;
    this.indexPath = `${this.cacheDir}${INDEX_FILENAME}`;
    this.maxBytes = Math.max(1024, options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES);
  }

  private fileUri(checksumSha256: string): string {
    assertValidChecksum(checksumSha256);
    return `${this.cacheDir}${checksumSha256}.glb`;
  }

  private async ensureDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(this.cacheDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
    }
  }

  private async readIndex(): Promise<CacheIndexFile> {
    try {
      const info = await FileSystem.getInfoAsync(this.indexPath);
      if (!info.exists) return { version: 1, entries: {} };
      const raw = await FileSystem.readAsStringAsync(this.indexPath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as { version?: unknown }).version === 1 &&
        typeof (parsed as { entries?: unknown }).entries === 'object' &&
        (parsed as { entries?: unknown }).entries !== null
      ) {
        return parsed as CacheIndexFile;
      }
      return { version: 1, entries: {} };
    } catch {
      return { version: 1, entries: {} };
    }
  }

  private async writeIndex(index: CacheIndexFile): Promise<void> {
    await this.ensureDir();
    await FileSystem.writeAsStringAsync(this.indexPath, JSON.stringify(index), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  async getBuffer(checksumSha256: string): Promise<ArrayBuffer | null> {
    assertValidChecksum(checksumSha256);
    const uri = this.fileUri(checksumSha256);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buffer = base64ToArrayBuffer(base64);
      const index = await this.readIndex();
      index.entries[checksumSha256] = {
        checksumSha256,
        sizeBytes: buffer.byteLength,
        uri,
        lastAccessedAt: Date.now(),
      };
      await this.writeIndex(index);
      return buffer;
    } catch {
      await this.remove(checksumSha256);
      return null;
    }
  }

  async putBuffer(checksumSha256: string, buffer: ArrayBuffer): Promise<CachedGlbEntry> {
    assertValidChecksum(checksumSha256);
    await this.ensureDir();
    const uri = this.fileUri(checksumSha256);
    await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(buffer), {
      encoding: FileSystem.EncodingType.Base64,
    });

    const entry: CachedGlbEntry = {
      checksumSha256,
      sizeBytes: buffer.byteLength,
      uri,
      lastAccessedAt: Date.now(),
    };

    const index = await this.readIndex();
    index.entries[checksumSha256] = entry;
    await this.evictLru(index, checksumSha256);
    await this.writeIndex(index);
    return entry;
  }

  private async evictLru(index: CacheIndexFile, protectedKey: string): Promise<void> {
    let total = Object.values(index.entries).reduce((sum, item) => sum + item.sizeBytes, 0);
    if (total <= this.maxBytes) return;

    const candidates = Object.values(index.entries)
      .filter((item) => item.checksumSha256 !== protectedKey)
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    for (const victim of candidates) {
      if (total <= this.maxBytes) break;
      await FileSystem.deleteAsync(victim.uri, { idempotent: true });
      delete index.entries[victim.checksumSha256];
      total -= victim.sizeBytes;
    }
  }

  async remove(checksumSha256: string): Promise<void> {
    assertValidChecksum(checksumSha256);
    const uri = this.fileUri(checksumSha256);
    await FileSystem.deleteAsync(uri, { idempotent: true });
    const index = await this.readIndex();
    if (index.entries[checksumSha256]) {
      delete index.entries[checksumSha256];
      await this.writeIndex(index);
    }
  }

  async clear(): Promise<void> {
    await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
  }

  async getStats(): Promise<GlbCacheStats> {
    const index = await this.readIndex();
    const list = Object.values(index.entries);
    return {
      entryCount: list.length,
      totalBytes: list.reduce((sum, item) => sum + item.sizeBytes, 0),
      maxBytes: this.maxBytes,
    };
  }
}

/**
 * Cache in-memory có LRU phục vụ test đơn vị nhanh hoặc fallback khi không có cacheDirectory.
 */
export class InMemoryGlbCache implements GlbCacheAdapter {
  private readonly store = new Map<string, { buffer: ArrayBuffer; entry: CachedGlbEntry }>();
  private readonly maxBytes: number;
  private tick = 0;

  constructor(maxBytes = DEFAULT_MAX_CACHE_BYTES) {
    this.maxBytes = Math.max(1024, maxBytes);
  }

  async getBuffer(checksumSha256: string): Promise<ArrayBuffer | null> {
    assertValidChecksum(checksumSha256);
    const record = this.store.get(checksumSha256);
    if (!record) return null;
    record.entry.lastAccessedAt = ++this.tick;
    return record.buffer.slice(0);
  }

  async putBuffer(checksumSha256: string, buffer: ArrayBuffer): Promise<CachedGlbEntry> {
    assertValidChecksum(checksumSha256);
    const copy = buffer.slice(0);
    const entry: CachedGlbEntry = {
      checksumSha256,
      sizeBytes: copy.byteLength,
      uri: `memory://glb/${checksumSha256}.glb`,
      lastAccessedAt: ++this.tick,
    };
    this.store.set(checksumSha256, { buffer: copy, entry });

    let total = 0;
    for (const item of this.store.values()) total += item.entry.sizeBytes;
    if (total > this.maxBytes) {
      const victims = [...this.store.values()]
        .filter((item) => item.entry.checksumSha256 !== checksumSha256)
        .sort((a, b) => a.entry.lastAccessedAt - b.entry.lastAccessedAt);
      for (const victim of victims) {
        if (total <= this.maxBytes) break;
        this.store.delete(victim.entry.checksumSha256);
        total -= victim.entry.sizeBytes;
      }
    }
    return { ...entry };
  }

  async remove(checksumSha256: string): Promise<void> {
    assertValidChecksum(checksumSha256);
    this.store.delete(checksumSha256);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async getStats(): Promise<GlbCacheStats> {
    let totalBytes = 0;
    for (const item of this.store.values()) totalBytes += item.entry.sizeBytes;
    return {
      entryCount: this.store.size,
      totalBytes,
      maxBytes: this.maxBytes,
    };
  }
}
