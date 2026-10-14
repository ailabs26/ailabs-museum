import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { MediaFormatSpec } from '../inspection/media-formats';

export const MEDIA_STORAGE_ROOTS = Symbol('MEDIA_STORAGE_ROOTS');

export interface MediaStorageRoots {
  /** Thư mục được phục vụ tĩnh tại `PUBLIC_MEDIA_URL_PREFIX`. */
  publicRoot: string;
  /** Thư mục cách ly — KHÔNG được phục vụ ra ngoài. */
  quarantineRoot: string;
}

export const DEFAULT_MEDIA_STORAGE_ROOTS: MediaStorageRoots = {
  publicRoot: join(process.cwd(), 'public', 'media'),
  quarantineRoot: join(process.cwd(), 'storage', 'quarantine'),
};

export const PUBLIC_MEDIA_URL_PREFIX = '/media';

const QUARANTINE_PREFIX = 'quarantine/';
/** Chỉ chữ thường, số và các phân cách an toàn; không có "..", "\" hay đường dẫn tuyệt đối. */
const SAFE_KEY = /^[a-z0-9]+(?:[/_.-][a-z0-9]+)*$/;

/** Thư mục con theo kind trong vùng public. */
const KIND_DIRECTORIES: Record<string, string> = {
  model: 'models',
  image: 'images',
  audio: 'audio',
  subtitle: 'subtitles',
};

/**
 * Lưu file media trên đĩa cục bộ. Storage key do server sinh (UUID), mỗi file một key
 * duy nhất và không bao giờ bị ghi đè — media đang dùng không thể bị thay thế (BR-21).
 */
@Injectable()
export class MediaStorageService {
  constructor(@Inject(MEDIA_STORAGE_ROOTS) private readonly roots: MediaStorageRoots) {}

  /** Sinh storage key mới: `uploads/<kind>/<uuid>.<ext>` hoặc `quarantine/<uuid>.bin`. */
  createKey(spec: MediaFormatSpec, isQuarantined = false): string {
    const id = randomUUID();
    if (isQuarantined) return `${QUARANTINE_PREFIX}${id}.bin`;
    return `uploads/${KIND_DIRECTORIES[spec.kind]}/${id}.${spec.extension}`;
  }

  isQuarantineKey(key: string): boolean {
    return key.startsWith(QUARANTINE_PREFIX);
  }

  /** Ghi file; báo lỗi nếu key đã tồn tại thay vì ghi đè. */
  async save(key: string, data: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: 'wx' });
  }

  /** Xóa file; bỏ qua nếu file không còn tồn tại. */
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /** URL công khai của file; `null` với file trong vùng cách ly. */
  toPublicUrl(key: string): string | null {
    return this.isQuarantineKey(key) ? null : `${PUBLIC_MEDIA_URL_PREFIX}/${key}`;
  }

  private resolvePath(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error(`Storage key không hợp lệ: ${key}`);
    const [root, relativeKey] = this.isQuarantineKey(key)
      ? [this.roots.quarantineRoot, key.slice(QUARANTINE_PREFIX.length)]
      : [this.roots.publicRoot, key];
    const base = resolve(root);
    const path = resolve(base, relativeKey);
    if (!path.startsWith(base + sep)) throw new Error(`Storage key không hợp lệ: ${key}`);
    return path;
  }
}
