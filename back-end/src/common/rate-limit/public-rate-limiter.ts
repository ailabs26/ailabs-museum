import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Nhóm giới hạn: `api` cho JSON/XML nội dung, `media` cho tệp (ảnh, audio, GLB) — một trang mở ra nhiều tệp. */
export type PublicRateBucket = 'api' | 'media';

export interface PublicRateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Số giây tới khi cửa sổ mới bắt đầu (≥ 1). */
  retryAfter: number;
}

export const PUBLIC_RATE_WINDOW_MS = 60_000;
const DEFAULT_LIMITS: Record<PublicRateBucket, number> = { api: 600, media: 3000 };
const MAX_KEYS = 10_000;

/**
 * Đếm request theo IP trong cửa sổ cố định 1 phút cho các API công khai. Mục tiêu chặn bot cào
 * dữ liệu / dội request, không chặn khách: ngưỡng mặc định rộng vì cả đoàn khách chung một IP NAT.
 * Bộ nhớ trong tiến trình — chạy nhiều instance cần store dùng chung (Redis), như issue #82.
 */
@Injectable()
export class PublicRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  readonly limits: Record<PublicRateBucket, number>;
  /** Ghi đè được trong test. */
  now: () => number = Date.now;

  constructor(@Optional() config?: ConfigService) {
    const configured = config?.get<Record<PublicRateBucket, number>>('app.publicRateLimit');
    this.limits = { ...DEFAULT_LIMITS, ...configured };
  }

  consume(bucket: PublicRateBucket, ip: string): PublicRateResult {
    const now = this.now();
    const limit = this.limits[bucket];
    const key = `${bucket}:${ip}`;
    let window = this.windows.get(key);
    if (!window || now - window.start >= PUBLIC_RATE_WINDOW_MS) {
      this.pruneIfLarge(now);
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    const retryAfter = Math.max(1, Math.ceil((window.start + PUBLIC_RATE_WINDOW_MS - now) / 1000));
    if (window.count >= limit) return { allowed: false, limit, remaining: 0, retryAfter };
    window.count += 1;
    return { allowed: true, limit, remaining: limit - window.count, retryAfter };
  }

  /** Dọn cửa sổ đã hết hạn để Map không phình vô hạn khi có nhiều IP lạ. */
  private pruneIfLarge(now: number): void {
    if (this.windows.size < MAX_KEYS) return;
    for (const [key, window] of this.windows) {
      if (now - window.start >= PUBLIC_RATE_WINDOW_MS) this.windows.delete(key);
    }
  }
}
