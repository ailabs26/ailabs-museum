/** Chi tiết 1 lỗi field (validation) hoặc lỗi nghiệp vụ. */
export interface ApiError {
  field?: string;
  code: string;
  message: string;
}

/** Thông tin phân trang đính kèm cho endpoint list. */
export interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Envelope chuẩn cho MỌI response (xem 06-api-contract.md).
 * Thành công: { success:true, data }. Lỗi: { success:false, message, errors }.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors?: ApiError[];
  meta?: ApiMeta;
}

export function ok<T>(data: T, meta?: ApiMeta): ApiResponse<T> {
  return { success: true, data, message: null, ...(meta ? { meta } : {}) };
}

export function fail(message: string, errors?: ApiError[]): ApiResponse<null> {
  return { success: false, data: null, message, ...(errors ? { errors } : {}) };
}
