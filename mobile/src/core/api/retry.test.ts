import { ApiException, CANCELED_ERROR_CODE, parseRetryAfter } from './api-error';
import { MAX_DELAY_MS, MAX_RETRIES, retryDelay, shouldRetry } from './retry';

describe('shouldRetry', () => {
  it('thử lại lỗi tạm thời tới MAX_RETRIES lần', () => {
    expect(shouldRetry(0, new ApiException('mất mạng', 0))).toBe(true);
    expect(shouldRetry(1, new ApiException('lỗi server', 503))).toBe(true);
    expect(shouldRetry(0, new ApiException('timeout', 408))).toBe(true);
    expect(shouldRetry(0, new ApiException('quá tải', 429))).toBe(true);
    expect(shouldRetry(MAX_RETRIES, new ApiException('mất mạng', 0))).toBe(false);
  });

  it('không thử lại 4xx, request bị hủy, lỗi không phải HTTP', () => {
    expect(shouldRetry(0, new ApiException('không tìm thấy', 404))).toBe(false);
    expect(shouldRetry(0, new ApiException('hết hạn', 401))).toBe(false);
    expect(shouldRetry(0, new ApiException('hủy', 0, [{ code: CANCELED_ERROR_CODE, message: 'hủy' }]))).toBe(false);
    expect(shouldRetry(0, new TypeError('bug'))).toBe(false);
  });

  it('server bắt chờ quá lâu (Retry-After > trần) -> báo lỗi luôn, không treo màn hình', () => {
    expect(shouldRetry(0, new ApiException('quá tải', 429, [], MAX_DELAY_MS + 1))).toBe(false);
    expect(shouldRetry(0, new ApiException('quá tải', 429, [], 5_000))).toBe(true);
  });
});

describe('retryDelay', () => {
  it('lũy thừa theo lần thử, nằm trong [nửa khoảng, khoảng]', () => {
    const error = new ApiException('mất mạng', 0);
    expect(retryDelay(0, error, () => 0)).toBe(500);
    expect(retryDelay(0, error, () => 1)).toBe(1_000);
    expect(retryDelay(2, error, () => 1)).toBe(4_000);
  });

  it('không vượt trần 30s', () => {
    expect(retryDelay(20, new ApiException('mất mạng', 0), () => 1)).toBe(MAX_DELAY_MS);
  });

  it('ưu tiên Retry-After của server', () => {
    expect(retryDelay(0, new ApiException('quá tải', 429, [], 7_000), () => 0)).toBe(7_000);
  });
});

describe('parseRetryAfter', () => {
  it('đọc số giây hoặc ngày HTTP', () => {
    expect(parseRetryAfter('12')).toBe(12_000);
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', Date.parse('Thu, 01 Jan 2026 00:00:00 GMT'))).toBe(10_000);
  });

  it('giá trị không hợp lệ -> null', () => {
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('-3')).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});
