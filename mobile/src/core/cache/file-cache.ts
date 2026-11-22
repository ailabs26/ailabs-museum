import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { ApiException, NETWORK_ERROR_STATUS } from '@/core/api/api-error';
import { CACHE_LIMITS, selectEvictions } from './cache-policy';

/**
 * Cache file cho media lớn (GLB, audio) trên thiết bị — MOB-E3-05.
 *
 * - Tải thẳng xuống đĩa bằng `downloadAsync` (không qua bộ nhớ JS), vào file tạm rồi mới đổi tên:
 *   không bao giờ còn file tải dở trong cache.
 * - Nhiều lời gọi cùng lúc cho một file chỉ tải một lần.
 * - Index (JSON) nằm cùng thư mục cache: hệ điều hành dọn `cacheDirectory` thì index mất theo, không lệch.
 * - Sau mỗi lần tải, dọn file ít dùng nhất nếu loại đó vượt hạn mức (`cache-policy.ts`, MOB-E3-06).
 *
 * Web (Expo web, chỉ dùng khi dev) không có file system: trả thẳng URL gốc, không cache.
 */
export const CACHE_KINDS = ['glb', 'audio'] as const;
export type CacheKind = (typeof CACHE_KINDS)[number];

export interface CachedFile {
  kind: CacheKind;
  key: string;
  /** URL nguồn lần tải gần nhất (tham khảo; khóa mới là định danh). */
  url: string;
  /** Đường dẫn cục bộ `file://` — đưa thẳng cho expo-av / GLTFLoader. */
  uri: string;
  sizeBytes: number;
  lastAccessedAt: number;
}

export interface CachedFileResult extends CachedFile {
  /** true nếu lấy từ cache, false nếu vừa tải. */
  fromCache: boolean;
}

export interface CacheUsage {
  count: number;
  bytes: number;
}

export interface GetFileOptions {
  kind: CacheKind;
  /**
   * Định danh ổn định của file (vd checksum, id media). Bỏ trống thì dùng URL đã bỏ query/hash —
   * URL ký sẵn (presigned) đổi chữ ký mỗi lần nên không được làm khóa.
   */
  key?: string;
  headers?: Record<string, string>;
}

interface IndexFile {
  version: 1;
  entries: Record<string, CachedFile>;
}

const ROOT_DIR_NAME = 'aura-file-cache/';
const INDEX_NAME = 'index.v1.json';
const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}$/;

/** Bỏ query và hash: chữ ký presigned không làm đổi khóa cache. */
export function stableUrl(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? url;
}

/** Đuôi file theo URL (giúp expo-av nhận dạng định dạng audio); không hợp lệ thì bỏ. */
function extensionOf(url: string): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(stableUrl(url));
  return match?.[1] ? `.${match[1].toLowerCase()}` : '';
}

const entryId = (kind: CacheKind, key: string) => `${kind}:${key}`;

export class FileCache {
  private readonly root: string | null;
  private readonly now: () => number;
  private readonly limits: Readonly<Record<CacheKind, number>>;
  private readonly pending = new Map<string, Promise<CachedFileResult>>();
  /** Ghi index tuần tự: hai thao tác song song không làm mất cập nhật của nhau. */
  private indexLock: Promise<unknown> = Promise.resolve();

  constructor(
    options: { rootDir?: string | null; now?: () => number; limits?: Partial<Record<CacheKind, number>> } = {},
  ) {
    const base = options.rootDir === undefined ? FileSystem.cacheDirectory : options.rootDir;
    this.root = base ? `${base.endsWith('/') ? base : `${base}/`}${ROOT_DIR_NAME}` : null;
    this.now = options.now ?? Date.now;
    this.limits = { ...CACHE_LIMITS, ...options.limits };
  }

  /** Có cache trên đĩa không (false trên web). */
  get enabled(): boolean {
    return this.root !== null;
  }

  /** Lấy file đã cache (cập nhật thời điểm dùng); null nếu chưa có hoặc file đã bị hệ điều hành xóa. */
  async get(kind: CacheKind, key: string): Promise<CachedFile | null> {
    if (!this.root) return null;
    const id = entryId(kind, key);
    const entry = (await this.readIndex()).entries[id];
    if (!entry) return null;
    if (!(await FileSystem.getInfoAsync(entry.uri)).exists) {
      await this.updateIndex((index) => void delete index.entries[id]);
      return null;
    }
    const touched = { ...entry, lastAccessedAt: this.now() };
    await this.updateIndex((index) => {
      if (index.entries[id]) index.entries[id] = touched;
    });
    return touched;
  }

  /** Trả file cục bộ; chưa có thì tải một lần rồi lưu. Lỗi tải ném `ApiException` (mất mạng: status 0). */
  async getOrDownload(url: string, options: GetFileOptions): Promise<CachedFileResult> {
    if (!this.root) {
      return { kind: options.kind, key: options.key ?? url, url, uri: url, sizeBytes: 0, lastAccessedAt: this.now(), fromCache: false };
    }
    const key = options.key ?? (await this.keyForUrl(url));
    if (!SAFE_KEY.test(key)) throw new Error(`Khóa cache không hợp lệ: ${key}`);

    // Cả bước "xem cache rồi tải" nằm trong một promise dùng chung theo khóa: lời gọi đến sau
    // không thể lọt vào khe giữa lúc kiểm tra cache và lúc bắt đầu tải.
    const id = entryId(options.kind, key);
    let pending = this.pending.get(id);
    if (!pending) {
      pending = this.resolve(url, options.kind, key, options.headers).finally(() => this.pending.delete(id));
      this.pending.set(id, pending);
    }
    return pending;
  }

  private async resolve(url: string, kind: CacheKind, key: string, headers?: Record<string, string>): Promise<CachedFileResult> {
    const cached = await this.get(kind, key);
    if (cached) return { ...cached, fromCache: true };
    return { ...(await this.download(url, kind, key, headers)), fromCache: false };
  }

  async remove(kind: CacheKind, key: string): Promise<void> {
    if (!this.root) return;
    const id = entryId(kind, key);
    const entry = (await this.readIndex()).entries[id];
    if (entry) await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    await this.updateIndex((index) => void delete index.entries[id]);
  }

  /** Xóa một loại, hoặc toàn bộ cache khi không truyền `kind`. */
  async clear(kind?: CacheKind): Promise<void> {
    if (!this.root) return;
    const root = this.root;
    if (!kind) {
      await this.withIndexLock(() => FileSystem.deleteAsync(root, { idempotent: true }));
      return;
    }
    await FileSystem.deleteAsync(`${root}${kind}/`, { idempotent: true });
    await this.updateIndex((index) => {
      for (const id of Object.keys(index.entries)) if (index.entries[id]?.kind === kind) delete index.entries[id];
    });
  }

  /** Danh sách file đã cache (cho chính sách dọn LRU và màn quản lý cache). */
  async list(kind?: CacheKind): Promise<CachedFile[]> {
    if (!this.root) return [];
    const entries = Object.values((await this.readIndex()).entries);
    return kind ? entries.filter((entry) => entry.kind === kind) : entries;
  }

  async getUsage(): Promise<Record<CacheKind, CacheUsage>> {
    const usage = Object.fromEntries(CACHE_KINDS.map((kind) => [kind, { count: 0, bytes: 0 }])) as Record<CacheKind, CacheUsage>;
    for (const entry of await this.list()) {
      usage[entry.kind].count += 1;
      usage[entry.kind].bytes += entry.sizeBytes;
    }
    return usage;
  }

  private async keyForUrl(url: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, stableUrl(url));
  }

  private async download(url: string, kind: CacheKind, key: string, headers?: Record<string, string>): Promise<CachedFile> {
    const root = this.root as string;
    const dir = `${root}${kind}/`;
    const uri = `${dir}${key}${extensionOf(url)}`;
    const tmp = `${uri}.${this.now()}.part`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    try {
      let result: FileSystem.FileSystemDownloadResult;
      try {
        result = await FileSystem.downloadAsync(url, tmp, headers ? { headers } : undefined);
      } catch {
        throw new ApiException('Không tải được tệp — kiểm tra kết nối mạng', NETWORK_ERROR_STATUS);
      }
      if (result.status < 200 || result.status >= 300) {
        throw new ApiException(`Không tải được tệp (HTTP ${result.status})`, result.status);
      }
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: uri });
    } finally {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    }
    const info = await FileSystem.getInfoAsync(uri);
    const entry: CachedFile = {
      kind,
      key,
      url,
      uri,
      sizeBytes: info.exists ? info.size : 0,
      lastAccessedAt: this.now(),
    };
    await this.updateIndex((index) => {
      index.entries[entryId(kind, key)] = entry;
    });
    await this.enforceLimit(kind, key);
    return entry;
  }

  /** Xóa file ít dùng nhất của `kind` tới khi về dưới hạn mức; giữ file `keep` vừa tải. Trả số byte đã giải phóng. */
  async enforceLimit(kind: CacheKind, keep?: string): Promise<number> {
    const victims = selectEvictions(await this.list(kind), this.limits[kind], keep ? [keep] : []);
    for (const victim of victims) await this.remove(kind, victim.key);
    return victims.reduce((sum, victim) => sum + victim.sizeBytes, 0);
  }

  private indexPath(): string {
    return `${this.root as string}${INDEX_NAME}`;
  }

  private async readIndex(): Promise<IndexFile> {
    try {
      const raw = await FileSystem.readAsStringAsync(this.indexPath());
      const parsed = JSON.parse(raw) as Partial<IndexFile>;
      if (parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
        return { version: 1, entries: parsed.entries };
      }
    } catch {
      // Chưa có index hoặc index hỏng: coi như cache trống (file mồ côi được ghi đè khi tải lại).
    }
    return { version: 1, entries: {} };
  }

  private withIndexLock<T>(work: () => Promise<T>): Promise<T> {
    const run = this.indexLock.then(work, work);
    this.indexLock = run.catch(() => undefined);
    return run;
  }

  private updateIndex(mutate: (index: IndexFile) => void): Promise<void> {
    return this.withIndexLock(async () => {
      const index = await this.readIndex();
      mutate(index);
      await FileSystem.makeDirectoryAsync(this.root as string, { intermediates: true });
      await FileSystem.writeAsStringAsync(this.indexPath(), JSON.stringify(index));
    });
  }
}

/** Cache dùng chung toàn app. */
export const fileCache = new FileCache();
