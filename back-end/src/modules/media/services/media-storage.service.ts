import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import { MediaFormatSpec } from '../inspection/media-formats';
import { ByteRange, MEDIA_STORAGE_DRIVER, MediaStorageDriver } from '../storage/media-storage-driver';

/** Tiền tố URL phân phối file media (ngoài prefix /api). */
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
 * Lưu file media qua driver (đĩa cục bộ hoặc Supabase Storage). Storage key do server sinh
 * (UUID), mỗi file một key duy nhất và không bao giờ bị ghi đè — media đang dùng không thể
 * bị thay thế (BR-21).
 */
@Injectable()
export class MediaStorageService {
  constructor(@Inject(MEDIA_STORAGE_DRIVER) private readonly driver: MediaStorageDriver) {}

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
    assertSafeKey(key);
    await this.driver.put(key, data);
  }

  /** Xóa file; bỏ qua nếu file không còn tồn tại. */
  async remove(key: string): Promise<void> {
    assertSafeKey(key);
    await this.driver.delete(key);
  }

  /**
   * Mở luồng đọc file trong vùng public để phân phối; `null` nếu key thuộc vùng cách ly,
   * không hợp lệ hoặc file không còn (không bao giờ đọc file quarantine ra ngoài).
   */
  async openPublic(key: string, range?: ByteRange): Promise<Readable | null> {
    if (this.isQuarantineKey(key) || !SAFE_KEY.test(key)) return null;
    return this.driver.read(key, range);
  }
}

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) throw new Error(`Storage key không hợp lệ: ${key}`);
}
