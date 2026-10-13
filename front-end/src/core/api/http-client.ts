import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { z } from 'zod';
import { env } from '../config/env';
import { tokenStore } from '../auth/token-store';
import { parseAuthResponse, refreshResultSchema } from '../auth/authSchema';
import type { ApiResponse, Page } from './api-response';
import { toApiException } from './api-error';
import { loadingStore } from './loading-store';

/** Axios instance dùng chung: gắn token, gửi cookie refresh, tự refresh khi 401. */
const client = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
});

client.interceptors.request.use((config) => {
  loadingStore.start();
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh single-flight: nhiều request 401 cùng lúc chỉ gọi /auth/refresh một lần
let refreshing: Promise<string | null> | null = null;
const refreshEnvelopeSchema = z.object({
  success: z.literal(true),
  data: refreshResultSchema,
});

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    const version = tokenStore.getVersion();

    refreshing = axios
      .post<unknown>(
        `${env.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 20000 },
      )
      .then((res) => {
        const { data } = parseAuthResponse(refreshEnvelopeSchema, res.data);

        // Phiên đã bị xóa/đổi trong khi refresh đang chạy thì bỏ token trả về.
        if (version !== tokenStore.getVersion()) {
          return null;
        }

        tokenStore.set(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        if (version === tokenStore.getVersion()) {
          tokenStore.clear();
        }

        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

client.interceptors.response.use(
  (response) => {
    loadingStore.done();
    return response;
  },
  async (error) => {
    loadingStore.done();
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    const skipsRefresh = /\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(original?.url ?? '');

    if (status === 401 && original && !original._retried && !skipsRefresh && tokenStore.canRefresh()) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return client(original);
      }
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
  async waitForRefresh(): Promise<void> {
    await refreshing;
  },
  raw: client,
};
