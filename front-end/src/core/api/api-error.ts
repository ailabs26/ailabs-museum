import { AxiosError } from 'axios';
import type { ApiError, ApiResponse } from './api-response';

/** Lỗi chuẩn hóa ném ra từ http-client để UI/react-query xử lý đồng nhất. */
export class ApiException extends Error {
  readonly status: number;
  readonly errors: ApiError[];

  constructor(message: string, status: number, errors: ApiError[] = []) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.errors = errors;
  }

  /** Lỗi theo từng field (để map vào form). */
  get fieldErrors(): Record<string, string> {
    return this.errors.reduce<Record<string, string>>((acc, e) => {
      if (e.field) acc[e.field] = e.message;
      return acc;
    }, {});
  }
}

/** Chuyển AxiosError -> ApiException với thông điệp tiếng Việt thân thiện. */
export function toApiException(error: unknown): ApiException {
  if (error instanceof ApiException) return error;
  const axiosErr = error as AxiosError<ApiResponse<unknown>>;
  const status = axiosErr.response?.status ?? 0;
  const body = axiosErr.response?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    return new ApiException(body.message ?? 'Đã xảy ra lỗi', status, body.errors ?? []);
  }
  if (status === 0) return new ApiException('Không kết nối được máy chủ', 0);
  return new ApiException(axiosErr.message ?? 'Đã xảy ra lỗi', status);
}

/**
 * Lỗi kết thúc phiên thật: chỉ 401 (refresh token hết hạn, bị thu hồi, phiên đã đổi).
 * 429 / 5xx / mất mạng là sự cố tạm thời — giữ phiên để thử lại (issue #128).
 */
export function endsSession(error: unknown): boolean {
  return toApiException(error).status === 401;
}
