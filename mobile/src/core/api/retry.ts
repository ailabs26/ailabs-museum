import { ApiException } from './api-error';

/**
 * Chính sách thử lại khi lỗi mạng/server (MOB-E12-03), dùng cho react-query (`retry`, `retryDelay`).
 *
 * - Chỉ thử lại lỗi tạm thời: mất mạng, 5xx, 408, 429. 4xx khác là lỗi của request, thử lại vô ích.
 * - Backoff lũy thừa (1s, 2s, 4s...) trần 30s, kèm "full jitter" để nhiều máy không cùng dội lại server một lúc.
 * - Server gửi `Retry-After` (429/503) thì chờ đúng thời gian đó; chờ quá lâu thì báo lỗi luôn thay vì treo màn hình.
 */
export const MAX_RETRIES = 3;
export const BASE_DELAY_MS = 1_000;
export const MAX_DELAY_MS = 30_000;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  // http-client luôn ném ApiException; lỗi khác (parse dữ liệu, bug) thử lại cũng không khỏi.
  if (failureCount >= MAX_RETRIES || !(error instanceof ApiException) || error.isCanceled)
    return false;
  if (error.retryAfterMs !== null && error.retryAfterMs > MAX_DELAY_MS) return false;
  const { status } = error;
  return error.isNetworkError || status >= 500 || status === 408 || status === 429;
}

/** Thời gian chờ trước lần thử thứ `attempt` (0 = lần thử lại đầu tiên). */
export function retryDelay(
  attempt: number,
  error: unknown,
  random: () => number = Math.random,
): number {
  if (error instanceof ApiException && error.retryAfterMs !== null) {
    return Math.min(error.retryAfterMs, MAX_DELAY_MS);
  }
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  // Không chờ quá ngắn: tối thiểu nửa khoảng, phần còn lại ngẫu nhiên.
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
