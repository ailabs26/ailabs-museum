import type { ApiException } from '@/core/api/api-error';

/**
 * Log lỗi API tập trung (MOB-E13-03).
 *
 * Chỉ ghi siêu dữ liệu: method, đường dẫn đã chuẩn hóa, status, mã lỗi, message, thời lượng, request id.
 * KHÔNG ghi body, header, query string — tránh lộ token và dữ liệu cá nhân (CLAUDE.md: thông tin người dùng là riêng tư).
 * Đường dẫn được gom nhóm (`/rooms/:id`) để thống kê theo endpoint.
 * Sink cắm thêm được: console khi dev, Sentry ở task Sentry (MOB-E13-01).
 */
export interface ApiErrorRecord {
  at: number;
  method: string;
  /** Đường dẫn đã bỏ query/hash và thay id bằng `:id`. */
  endpoint: string;
  /** 0 = không có phản hồi (mất mạng, timeout). */
  status: number;
  /** Mã lỗi đầu tiên của back-end (nếu có). */
  code: string | null;
  message: string;
  durationMs: number | null;
  /** `X-Request-Id` của back-end — để đối chiếu log server. */
  requestId: string | null;
}

export interface ApiErrorSummaryItem {
  method: string;
  endpoint: string;
  status: number;
  count: number;
  lastAt: number;
}

export type ApiErrorSink = (record: ApiErrorRecord) => void;

export const API_ERROR_LOG_CAPACITY = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{24,}$/i;
const NUMBER = /^\d+$/;

/** `/rooms/3f2c…?lang=vi` → `/rooms/:id` (bỏ cả origin nếu là URL tuyệt đối). */
export function normalizeEndpoint(url: string | undefined): string {
  const path = (url ?? '').replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/, 1)[0] ?? '';
  const segments = path
    .split('/')
    .map((segment) => (UUID.test(segment) || LONG_HEX.test(segment) || NUMBER.test(segment) ? ':id' : segment));
  const normalized = segments.join('/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export class ApiErrorLog {
  private records: ApiErrorRecord[] = [];
  private readonly sinks = new Set<ApiErrorSink>();

  constructor(private readonly capacity = API_ERROR_LOG_CAPACITY) {}

  record(record: ApiErrorRecord): void {
    this.records.push(record);
    if (this.records.length > this.capacity) this.records.splice(0, this.records.length - this.capacity);
    for (const sink of this.sinks) {
      try {
        sink(record);
      } catch {
        // Sink hỏng (vd Sentry chưa sẵn sàng) không được làm hỏng luồng gọi API.
      }
    }
  }

  /** Lỗi gần nhất trước. */
  getRecent(): ApiErrorRecord[] {
    return [...this.records].reverse();
  }

  /** Gom theo method + endpoint + status, nhiều nhất trước. */
  getSummary(): ApiErrorSummaryItem[] {
    const groups = new Map<string, ApiErrorSummaryItem>();
    for (const r of this.records) {
      const key = `${r.method} ${r.endpoint} ${r.status}`;
      const group = groups.get(key);
      if (group) {
        group.count += 1;
        group.lastAt = Math.max(group.lastAt, r.at);
      } else {
        groups.set(key, { method: r.method, endpoint: r.endpoint, status: r.status, count: 1, lastAt: r.at });
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
  }

  clear(): void {
    this.records = [];
  }

  addSink(sink: ApiErrorSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }
}

/** Log dùng chung toàn app. */
export const apiErrorLog = new ApiErrorLog();

/** Thông tin request tối thiểu để dựng bản ghi (không nhận body/header). */
export interface FailedRequestInfo {
  method?: string;
  url?: string;
  startedAt?: number;
  requestId?: string | null;
}

export function toApiErrorRecord(request: FailedRequestInfo, error: ApiException, now = Date.now()): ApiErrorRecord {
  return {
    at: now,
    method: (request.method ?? 'GET').toUpperCase(),
    endpoint: normalizeEndpoint(request.url),
    status: error.status,
    code: error.errors[0]?.code ?? null,
    message: error.message,
    durationMs: request.startedAt === undefined ? null : Math.max(0, now - request.startedAt),
    requestId: request.requestId ?? null,
  };
}

if (__DEV__ && process.env.NODE_ENV !== 'test') {
  apiErrorLog.addSink((r) =>
    console.warn(`[API] ${r.method} ${r.endpoint} -> ${r.status} ${r.message}${r.requestId ? ` (req ${r.requestId})` : ''}`),
  );
}
