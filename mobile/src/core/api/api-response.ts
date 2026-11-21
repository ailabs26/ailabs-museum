/** Khớp envelope ApiResponse<T> của back-end (giống `front-end/src/core/api/api-response.ts`). */
export interface ApiError {
  field?: string;
  code: string;
  message: string;
}

export interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors?: ApiError[];
  meta?: ApiMeta;
}

/** Trang dữ liệu đã bóc envelope cho màn hình dùng. */
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
