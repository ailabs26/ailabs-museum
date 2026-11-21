import { AxiosError, isCancel } from 'axios';
import type { ApiError, ApiResponse } from './api-response';

/** status 0 = không có phản hồi từ máy chủ (mất mạng, timeout, DNS...). */
export const NETWORK_ERROR_STATUS = 0;

/** Mã lỗi gắn khi request bị hủy chủ động (react-query hủy query, rời màn hình...). */
export const CANCELED_ERROR_CODE = 'CANCELED';

/** Lỗi chuẩn hóa ném ra từ http-client để UI/react-query xử lý đồng nhất (MOB-E3-01). */
export class ApiException extends Error {
  readonly status: number;
  readonly errors: ApiError[];

  constructor(message: string, status: number, errors: ApiError[] = []) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.errors = errors;
  }

  /** Request bị hủy chủ động — không phải lỗi, không retry, không log. */
  get isCanceled(): boolean {
    return this.errors.some((e) => e.code === CANCELED_ERROR_CODE);
  }

  /** Không có phản hồi từ máy chủ — thường thử lại được khi có mạng. */
  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS && !this.isCanceled;
  }

  /** Lỗi theo từng field (để map vào form). */
  get fieldErrors(): Record<string, string> {
    return this.errors.reduce<Record<string, string>>((acc, e) => {
      if (e.field) acc[e.field] = e.message;
      return acc;
    }, {});
  }
}

function isEnvelope(body: unknown): body is ApiResponse<unknown> {
  return typeof body === 'object' && body !== null && 'success' in body;
}

/** Chuyển lỗi bất kỳ (AxiosError, Error...) -> ApiException với thông điệp thân thiện. */
export function toApiException(error: unknown): ApiException {
  if (error instanceof ApiException) return error;
  if (isCancel(error)) {
    const message = 'Yêu cầu đã bị hủy';
    return new ApiException(message, NETWORK_ERROR_STATUS, [{ code: CANCELED_ERROR_CODE, message }]);
  }
  if (!(error instanceof AxiosError)) {
    return new ApiException(error instanceof Error ? error.message : 'Đã xảy ra lỗi', NETWORK_ERROR_STATUS);
  }
  const status = error.response?.status ?? NETWORK_ERROR_STATUS;
  const body: unknown = error.response?.data;
  if (isEnvelope(body)) {
    return new ApiException(body.message ?? 'Đã xảy ra lỗi', status, body.errors ?? []);
  }
  if (status === NETWORK_ERROR_STATUS) {
    const timedOut = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT;
    return new ApiException(timedOut ? 'Máy chủ phản hồi quá lâu' : 'Không kết nối được máy chủ', NETWORK_ERROR_STATUS);
  }
  return new ApiException(error.message || 'Đã xảy ra lỗi', status);
}

/**
 * Lỗi kết thúc phiên thật: chỉ 401 (refresh token hết hạn, bị thu hồi).
 * 429 / 5xx / mất mạng là sự cố tạm thời — giữ phiên để thử lại (giống web, issue #128).
 */
export function endsSession(error: unknown): boolean {
  return toApiException(error).status === 401;
}
