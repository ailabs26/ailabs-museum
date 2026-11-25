import * as Sentry from '@sentry/react-native';
import { appConfig } from '@/config/env';
import { ApiException } from '@/core/api/api-error';
import { apiErrorLog, normalizeEndpoint, type ApiErrorRecord } from './api-error-log';

type BeforeSend = NonNullable<Sentry.ReactNativeOptions['beforeSend']>;
type SentryEvent = Parameters<BeforeSend>[0];
type SentryHint = Parameters<BeforeSend>[1];

/**
 * Gửi crash về Sentry (MOB-E13-01). Chỉ chạy khi có DSN; không có thì mọi hàm là no-op.
 * Không gửi dữ liệu cá nhân: bỏ user, request, tên máy; che email/token/query trong thông điệp và URL.
 * Crash native không đi qua `beforeSend` của JS → dựa vào `sendDefaultPii: false` và breadcrumb đã lọc.
 */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;
const BEARER = /\bBearer\s+\S+/gi;
const LONG_HEX = /\b[0-9a-f]{32,}\b/gi;
const URL_QUERY = /(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi;

export function scrubText(text: string): string {
  return text
    .replace(URL_QUERY, '$1')
    .replace(BEARER, '[token]')
    .replace(JWT, '[token]')
    .replace(EMAIL, '[email]')
    .replace(LONG_HEX, '[hex]');
}

/** Mất mạng và request bị hủy là chuyện bình thường trên di động, không phải lỗi của app. */
function isExpected(error: unknown): boolean {
  return error instanceof ApiException && (error.isNetworkError || error.isCanceled);
}

export function scrubEvent(event: SentryEvent, hint: SentryHint): SentryEvent | null {
  if (isExpected(hint.originalException)) return null;
  delete event.user;
  delete event.request;
  delete event.server_name;
  delete event.extra;
  // iOS đặt tên máy theo tên chủ ("iPhone của ...").
  if (event.contexts?.device) delete event.contexts.device.name;
  if (event.message) event.message = scrubText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  return event;
}

/** Giữ dấu vết điều hướng và request (đường dẫn đã gom nhóm); bỏ console, thao tác chạm và loại khác. */
export function scrubBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  const { category, timestamp, level, data } = crumb;
  if (category === 'api') return crumb;
  if (category === 'navigation') {
    const path = (value: unknown) => (typeof value === 'string' ? normalizeEndpoint(value) : undefined);
    return { category, timestamp, level, data: { from: path(data?.from), to: path(data?.to) } };
  }
  if (category === 'xhr' || category === 'fetch' || category === 'http') {
    const url = typeof data?.url === 'string' ? normalizeEndpoint(data.url) : undefined;
    return { category, timestamp, level, data: { method: data?.method, url, status_code: data?.status_code } };
  }
  return null;
}

const API_REPORT_INTERVAL_MS = 60_000;

/** 5xx thành sự kiện (mỗi endpoint + status tối đa một lần mỗi phút — request tự thử lại); còn lại là breadcrumb. */
export function createApiErrorSink(now: () => number = Date.now): (record: ApiErrorRecord) => void {
  const lastReported = new Map<string, number>();
  return (record) => {
    const { method, endpoint, status, code, durationMs, requestId } = record;
    const message = `API ${status} ${method} ${endpoint}`;
    if (status < 500) {
      Sentry.addBreadcrumb({ category: 'api', level: 'warning', message, data: { code, durationMs, requestId } });
      return;
    }
    const last = lastReported.get(message);
    if (last !== undefined && now() - last < API_REPORT_INTERVAL_MS) return;
    lastReported.set(message, now());
    Sentry.captureMessage(message, {
      level: 'error',
      fingerprint: ['api', method, endpoint, String(status)],
      tags: { api_status: String(status), ...(requestId ? { request_id: requestId } : {}) },
    });
  };
}

let started = false;

/** Gọi một lần khi app mở. Lỗi của Sentry không được làm hỏng app. */
export function initSentry(dsn: string | null = appConfig.sentryDsn): void {
  if (!dsn || started) return;
  started = true;
  try {
    Sentry.init({
      dsn,
      environment: appConfig.appEnv,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableAutoSessionTracking: false,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    apiErrorLog.addSink(createApiErrorSink());
  } catch (error) {
    console.warn('[Sentry] Không khởi tạo được', error);
  }
}

/** Báo lỗi đã được app xử lý (vd màn lỗi toàn cục). */
export function reportError(error: unknown): void {
  if (!isExpected(error)) Sentry.captureException(error);
}
