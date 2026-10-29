import { HttpException, HttpStatus, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AuthRateLimits {
  /** Số lần đăng nhập sai tối đa cho một email trong cửa sổ `emailWindowMs`. */
  emailFailures: number;
  emailWindowMs: number;
  /** Số request login tối đa cho một IP trong cửa sổ `ipWindowMs`. */
  ipRequests: number;
  ipWindowMs: number;
  /** Refresh: tối đa mỗi phiên (family refresh token) trong `refreshWindowMs`. */
  refreshPerSession: number;
  /** Refresh: trần rộng cho một IP (nhiều người chung IP văn phòng). */
  refreshPerIp: number;
  /** Refresh không có cookie hoặc cookie không khớp phiên nào: tối đa cho một IP (chống dò token). */
  refreshInvalidPerIp: number;
  refreshWindowMs: number;
}

export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  emailFailures: 5,
  emailWindowMs: 15 * 60_000,
  ipRequests: 20,
  ipWindowMs: 60_000,
  refreshPerSession: 30,
  refreshPerIp: 300,
  refreshInvalidPerIp: 20,
  refreshWindowMs: 60_000,
};

/** Loại giới hạn bị chạm — dùng làm khóa ghi audit "bị chặn" 1 lần mỗi cửa sổ. */
export type AuthBlockKind = 'ip' | 'email' | 'refresh_ip' | 'refresh_session' | 'refresh_invalid';

/**
 * Chống brute-force cho /auth/login và giới hạn /auth/refresh (NFR-57, issue #126).
 * - Login: 20 request/phút/IP + 5 lần sai/15 phút/email.
 * - Refresh **tách khỏi login**: mỗi lần tải lại trang tốn 1 refresh (access token chỉ ở bộ nhớ FE), nên
 *   đếm theo phiên; theo IP chỉ là trần rộng; request không có/cookie sai đếm chặt theo IP.
 * Cửa sổ trượt trong bộ nhớ: đủ cho một instance; nhiều instance cần store dùng chung (Redis).
 */
@Injectable()
export class AuthRateLimiter {
  private readonly ipHits = new Map<string, number[]>();
  private readonly emailFailures = new Map<string, number[]>();
  private readonly refreshIpHits = new Map<string, number[]>();
  private readonly refreshSessionHits = new Map<string, number[]>();
  private readonly refreshInvalidHits = new Map<string, number[]>();
  /** Lần ghi audit "bị chặn" gần nhất theo khóa (loại:giá trị). */
  private readonly blockAudits = new Map<string, number>();

  /** Ghi đè được trong test; ngưỡng refresh lấy từ env (`jwt.refreshRateLimit`) nếu có. */
  limits: AuthRateLimits;
  now: () => number = Date.now;

  constructor(@Optional() config?: ConfigService) {
    const refresh = config?.get<{ perSession: number; perIp: number; invalidPerIp: number }>('jwt.refreshRateLimit');
    this.limits = {
      ...DEFAULT_AUTH_RATE_LIMITS,
      ...(refresh && {
        refreshPerSession: refresh.perSession,
        refreshPerIp: refresh.perIp,
        refreshInvalidPerIp: refresh.invalidPerIp,
      }),
    };
  }

  /** Tính một request login của IP; ném 429 khi vượt ngưỡng. */
  consumeIp(ip: string): void {
    this.consume(this.ipHits, ip, this.limits.ipRequests, this.limits.ipWindowMs);
  }

  /** Mọi request refresh: trần rộng theo IP, kiểm trước khi chạm DB. */
  consumeRefreshIp(ip: string): void {
    this.consume(this.refreshIpHits, ip, this.limits.refreshPerIp, this.limits.refreshWindowMs);
  }

  /** Refresh có cookie khớp một phiên: đếm theo phiên (family). */
  consumeRefreshSession(familyId: string): void {
    this.consume(this.refreshSessionHits, familyId, this.limits.refreshPerSession, this.limits.refreshWindowMs);
  }

  /** Refresh không có cookie hoặc cookie không khớp phiên nào: đếm chặt theo IP. */
  consumeRefreshInvalid(ip: string): void {
    this.consume(this.refreshInvalidHits, ip, this.limits.refreshInvalidPerIp, this.limits.refreshWindowMs);
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
   * true cho lần bị chặn đầu tiên trong mỗi cửa sổ của một khóa: ghi audit 1 lần thay vì mọi request
   * bị chặn (tránh chính audit làm ngập DB khi bị dò mật khẩu / spam refresh).
   */
  shouldAuditBlock(kind: AuthBlockKind, value: string): boolean {
    const key = `${kind}:${kind === 'email' ? this.key(value) : value}`;
    const windowMs = kind === 'email' ? this.limits.emailWindowMs
      : kind === 'ip' ? this.limits.ipWindowMs
        : this.limits.refreshWindowMs;
    const last = this.blockAudits.get(key);
    if (last !== undefined && this.now() - last < windowMs) return false;
    if (this.blockAudits.size > 10_000) this.blockAudits.clear();
    this.blockAudits.set(key, this.now());
    return true;
  }

  resetEmail(email: string): void {
    this.emailFailures.delete(this.key(email));
  }

  /** Tính một lần vào bộ đếm cửa sổ trượt; ném 429 kèm thời điểm thử lại khi đã đủ `max`. */
  private consume(store: Map<string, number[]>, key: string, max: number, windowMs: number): void {
    const hits = this.prune(store, key, windowMs);
    if (hits.length >= max) {
      throw this.tooMany(hits[0] + windowMs);
    }
    hits.push(this.now());
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
