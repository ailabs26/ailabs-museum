import { Readable } from 'node:stream';

export const MEDIA_STORAGE_DRIVER = Symbol('MEDIA_STORAGE_DRIVER');

/** Loại driver lưu file, chọn qua env `MEDIA_STORAGE_DRIVER`. */
export type MediaStorageDriverName = 'local' | 'supabase';

/** Đoạn byte cần đọc, `end` tính cả byte cuối (giống header Range). */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Nơi lưu file media. Key đã được `MediaStorageService` kiểm tra an toàn trước khi tới driver.
 * Chỉ gồm các thao tác code nghiệp vụ đang dùng.
 */
export interface MediaStorageDriver {
  /** Ghi object mới; PHẢI báo lỗi nếu key đã tồn tại — không bao giờ ghi đè (BR-21). */
  put(key: string, data: Buffer): Promise<void>;
  /** Xóa object; bỏ qua nếu không còn tồn tại. */
  delete(key: string): Promise<void>;
  /** Mở luồng đọc toàn bộ hoặc một đoạn byte; `null` nếu object không tồn tại. */
  read(key: string, range?: ByteRange): Promise<Readable | null>;
}
