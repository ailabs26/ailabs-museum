import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from '../config/env';
import { tokenStore } from '../auth/token-store';
import type { ApiResponse, Page } from './api-response';
import { toApiException } from './api-error';

/** Axios instance dùng chung: gắn token, gửi cookie refresh, tự refresh khi 401. */
const client = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
});

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh single-flight: nhiều request 401 cùng lúc chỉ gọi /auth/refresh một lần
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post<ApiResponse<{ accessToken: string }>>(
        `${env.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => res.data.data?.accessToken ?? null)
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        tokenStore.set(token);
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return client(original);
      }
      tokenStore.clear();
    }
    return Promise.reject(toApiException(error));
  },
);

/** Bóc envelope -> trả thẳng data. */
function unwrap<T>(res: AxiosResponse<ApiResponse<T>>): T {
  return res.data.data as T;
}

/** Bóc envelope list -> Page<T> (gộp data + meta). */
function unwrapPage<T>(res: AxiosResponse<ApiResponse<T[]>>): Page<T> {
  const meta = res.data.meta ?? { page: 1, pageSize: res.data.data?.length ?? 0, total: res.data.data?.length ?? 0 };
  return { items: res.data.data ?? [], ...meta };
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
  raw: client,
};
