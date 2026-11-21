import { create, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { appConfig } from '@/config/env';
import type { ApiResponse, Page } from './api-response';
import { toApiException } from './api-error';

/** Mạng di động chập chờn: đủ lâu cho 3G, không treo màn hình vô hạn. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Axios instance dùng chung cho mọi service (MOB-E3-01).
 * Mọi lỗi được chuẩn hóa thành `ApiException` ngay tại interceptor, nên tầng trên chỉ cần bắt một kiểu.
 * Interceptor auth (Bearer + refresh) gắn thêm ở `core/auth` (MOB-E3-03).
 */
const client = create({
  baseURL: appConfig.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiException(error)),
);

/** Bóc envelope -> trả thẳng data. */
function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  return res.data.data as T;
}

/** Bóc envelope list -> Page<T> (gộp data + meta); thiếu meta thì coi cả danh sách là một trang. */
function unwrapPage<T>(res: AxiosResponse<ApiResponse<T[]>>): Page<T> {
  const items = res.data.data ?? [];
  const meta = res.data.meta ?? { page: 1, pageSize: items.length, total: items.length };
  return { items, ...meta };
}

export const http = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await client.get<ApiResponse<T>>(url, config));
  },
  async getPage<T>(url: string, config?: AxiosRequestConfig): Promise<Page<T>> {
    return unwrapPage(await client.get<ApiResponse<T[]>>(url, config));
  },
  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await client.post<ApiResponse<T>>(url, body, config));
  },
  async patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await client.patch<ApiResponse<T>>(url, body, config));
  },
  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await client.put<ApiResponse<T>>(url, body, config));
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap(await client.delete<ApiResponse<T>>(url, config));
  },
  /** Instance gốc — để gắn interceptor (auth, log lỗi) và adapter giả trong test. */
  raw: client,
};
