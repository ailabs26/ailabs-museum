import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export interface AuthRateLimits {
  /** Số lần đăng nhập sai tối đa cho một email trong cửa sổ `emailWindowMs`. */
  emailFailures: number;
  emailWindowMs: number;
  /** Số request login/refresh tối đa cho một IP trong cửa sổ `ipWindowMs`. */
  ipRequests: number;
  ipWindowMs: number;
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  emailFailures: 5,
  emailWindowMs: 15 * 60_000,
  ipRequests: 20,
  ipWindowMs: 60_000,
};

/**
 * Chống brute-force cho /auth/login và /auth/refresh (NFR-57).
 * Cửa sổ trượt trong bộ nhớ: đủ cho một instance; nhiều instance cần store dùng chung (Redis).
 * Tách khỏi ThrottlerModule của content-reports để không ảnh hưởng cấu hình throttle ở đó.
 */
@Injectable()
export class AuthRateLimiter {
  private readonly ipHits = new Map<string, number[]>();
  private readonly emailFailures = new Map<string, number[]>();
  /** Lần ghi audit `auth.login_blocked` gần nhất theo khóa chặn (ip:/email:). */
  private readonly blockAudits = new Map<string, number>();

  /** Ghi đè được trong test; production dùng mặc định. */
  limits: AuthRateLimits = DEFAULT_AUTH_RATE_LIMITS;
  now: () => number = Date.now;

  /** Tính một request của IP; ném 429 khi vượt ngưỡng. */
  consumeIp(ip: string): void {
    const hits = this.prune(this.ipHits, ip, this.limits.ipWindowMs);
    if (hits.length >= this.limits.ipRequests) {
      throw this.tooMany(hits[0] + this.limits.ipWindowMs);
    }
    hits.push(this.now());
  }

  /** Ném 429 nếu email đã sai quá nhiều lần (kiểm trước khi so mật khẩu). */
  assertEmailAllowed(email: string): void {
    const failures = this.prune(this.emailFailures, this.key(email), this.limits.emailWindowMs);
    if (failures.length >= this.limits.emailFailures) {
      throw this.tooMany(failures[0] + this.limits.emailWindowMs);
    }
  }

  recordEmailFailure(email: string): void {
    const key = this.key(email);
    this.prune(this.emailFailures, key, this.limits.emailWindowMs).push(this.now());
  }

  /**
   * true cho lần bị chặn đầu tiên trong mỗi cửa sổ của một IP/email: ghi audit 1 lần thay vì mọi request
   * bị chặn (tránh chính audit làm ngập DB khi bị dò mật khẩu).
   */
  shouldAuditBlock(kind: 'ip' | 'email', value: string): boolean {
    const key = `${kind}:${kind === 'email' ? this.key(value) : value}`;
    const windowMs = kind === 'ip' ? this.limits.ipWindowMs : this.limits.emailWindowMs;
    const last = this.blockAudits.get(key);
    if (last !== undefined && this.now() - last < windowMs) return false;
    if (this.blockAudits.size > 10_000) this.blockAudits.clear();
    this.blockAudits.set(key, this.now());
    return true;
  }

  resetEmail(email: string): void {
    this.emailFailures.delete(this.key(email));
  }

  private key(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Bỏ mốc quá hạn và dọn khóa rỗng để Map không phình vô hạn. */
  private prune(store: Map<string, number[]>, key: string, windowMs: number): number[] {
    const cutoff = this.now() - windowMs;
    const kept = (store.get(key) ?? []).filter((t) => t > cutoff);
    store.set(key, kept);
    if (store.size > 10_000) {
      for (const [k, v] of store) {
        if (v.length === 0 || v[v.length - 1] <= cutoff) store.delete(k);
      }
      store.set(key, kept);
    }
    return kept;
  }

  private tooMany(retryAtMs: number): HttpException {
    const retryAfter = Math.max(1, Math.ceil((retryAtMs - this.now()) / 1000));
    return new HttpException(
      { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau', retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
