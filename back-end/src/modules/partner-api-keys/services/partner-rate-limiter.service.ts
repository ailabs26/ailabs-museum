import { Injectable } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Số giây tới khi có thêm lượt (≥ 1). */
  retryAfter: number;
}

const WINDOW_MS = 60_000;

/**
 * Giới hạn request/phút cho từng API key (cửa sổ trượt trong bộ nhớ).
 * Đủ cho một instance; chạy nhiều instance cần store dùng chung (Redis) — xem issue #82.
 */
@Injectable()
export class PartnerRateLimiter {
  private readonly hits = new Map<string, number[]>();
  /** Ghi đè được trong test. */
  now: () => number = Date.now;

  consume(keyId: string, limit: number): RateLimitResult {
    const now = this.now();
    const recent = (this.hits.get(keyId) ?? []).filter((at) => at > now - WINDOW_MS);
    const retryAfter = Math.max(1, Math.ceil(((recent[0] ?? now) + WINDOW_MS - now) / 1000));
    if (recent.length >= limit) {
      this.hits.set(keyId, recent);
      return { allowed: false, limit, remaining: 0, retryAfter };
    }
    recent.push(now);
    this.hits.set(keyId, recent);
    return { allowed: true, limit, remaining: limit - recent.length, retryAfter };
  }
}
