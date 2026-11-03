import { mkdir, open, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { ByteRange, MediaStorageDriver, StoragePrefix, StoredObject } from './media-storage-driver';

export interface MediaStorageRoots {
  /** Thư mục chứa file được phân phối (có kiểm soát) qua `MediaDeliveryController`. */
  publicRoot: string;
  /** Thư mục cách ly — KHÔNG được phục vụ ra ngoài. */
  quarantineRoot: string;
}

export const DEFAULT_MEDIA_STORAGE_ROOTS: MediaStorageRoots = {
  publicRoot: join(process.cwd(), 'public', 'media'),
  quarantineRoot: join(process.cwd(), 'storage', 'quarantine'),
};

const QUARANTINE_PREFIX = 'quarantine/';

/** Lưu file trên đĩa cục bộ (môi trường dev). */
export class LocalStorageDriver implements MediaStorageDriver {
  constructor(private readonly roots: MediaStorageRoots = DEFAULT_MEDIA_STORAGE_ROOTS) {}

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    // `wx`: lỗi EEXIST nếu file đã có thay vì ghi đè.
    await writeFile(path, data, { flag: 'wx' });
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async read(key: string, range?: ByteRange): Promise<Readable | null> {
    let handle;
    try {
      handle = await open(this.resolvePath(key), 'r');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    // Mở file trước rồi mới tạo stream để phát hiện "file mất" trước khi gửi header.
    return handle.createReadStream(range ? { start: range.start, end: range.end } : {});
  }

  /** `uploads/` nằm dưới publicRoot; `quarantine/` là quarantineRoot. Thư mục chưa tồn tại → không có gì. */
  async *list(prefix: StoragePrefix): AsyncIterable<StoredObject> {
    const dir = prefix === QUARANTINE_PREFIX ? resolve(this.roots.quarantineRoot) : resolve(this.roots.publicRoot, 'uploads');
    yield* walk(dir, prefix);
  }

  /** Ánh xạ key sang đường dẫn tuyệt đối, chặn mọi đường dẫn thoát khỏi thư mục gốc. */
  private resolvePath(key: string): string {
    const [root, relativeKey] = key.startsWith(QUARANTINE_PREFIX)
      ? [this.roots.quarantineRoot, key.slice(QUARANTINE_PREFIX.length)]
      : [this.roots.publicRoot, key];
    const base = resolve(root);
    const path = resolve(base, relativeKey);
    if (!path.startsWith(base + sep)) throw new Error(`Storage key không hợp lệ: ${key}`);
    return path;
  }
}

/** Duyệt đệ quy thư mục, trả key dạng `<prefix><đường dẫn tương đối>` với dấu `/`. */
async function* walk(dir: string, keyPrefix: string): AsyncIterable<StoredObject> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path, `${keyPrefix}${entry.name}/`);
    } else if (entry.isFile()) {
      yield { key: `${keyPrefix}${entry.name}`, lastModified: (await stat(path)).mtime };
    }
  }
}
