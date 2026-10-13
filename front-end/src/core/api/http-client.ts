import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { z } from 'zod';
import { env } from '../config/env';
import { tokenStore } from '../auth/token-store';
import { parseAuthResponse, refreshResultSchema } from '../auth/authSchema';
import type { ApiResponse, Page } from './api-response';
import { ApiException, toApiException } from './api-error';
import { loadingStore } from './loading-store';

/** Axios instance dùng chung: gắn token, gửi cookie refresh, tự refresh khi 401. */
const client = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  _sessionVersion?: number;
  _accessToken?: string | null;
};

function skipsRefresh(url: string | undefined): boolean {
  return /\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(url ?? '');
}

client.interceptors.request.use((config: SessionRequestConfig) => {
  config._sessionVersion ??= tokenStore.getSessionVersion();
  if (!skipsRefresh(config.url) && config._sessionVersion !== tokenStore.getSessionVersion()) {
    throw new ApiException('Phiên đăng nhập đã thay đổi', 401);
  }
  loadingStore.start();
  const token = tokenStore.get();
  config._accessToken = token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    config.headers.delete('Authorization');
  }
  return config;
});

// Refresh single-flight: nhiều request 401 cùng lúc chỉ gọi /auth/refresh một lần
let refreshing: Promise<string> | null = null;
const refreshEnvelopeSchema = z.object({
  success: z.literal(true),
  data: refreshResultSchema,
});

async function refreshAccessToken(): Promise<string> {
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
          throw new ApiException('Phiên đăng nhập đã thay đổi', 401);
        }

        tokenStore.replace(data.accessToken);
        return data.accessToken;
      })
      .catch((error: unknown) => {
        if (version === tokenStore.getVersion()) {
          tokenStore.clear();
        }

        throw toApiException(error);
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
    const config = response.config as SessionRequestConfig;
    if (!skipsRefresh(config.url)
      && config._sessionVersion !== tokenStore.getSessionVersion()
      && (config._accessToken || config.url === '/auth/me')) {
      throw new ApiException('Phiên đăng nhập đã thay đổi', 401);
    }
    return response;
  },
  async (error) => {
    loadingStore.done();
    const original = error.config as SessionRequestConfig | undefined;
    const status = error.response?.status;
    if (status === 401 && original && !skipsRefresh(original.url)
      && original._sessionVersion === tokenStore.getSessionVersion()
      && tokenStore.canRefresh()) {
      if (!original._retried) {
        original._retried = true;
        // 401 đến muộn sau rotation: retry bằng token mới, không rotate thêm lần nữa.
        const currentToken = tokenStore.get();
        const token = currentToken && currentToken !== original._accessToken
          ? currentToken
          : await refreshAccessToken();

        if (original._sessionVersion === tokenStore.getSessionVersion()) {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        }
      } else if (original._accessToken === tokenStore.get()) {
        // Retry vẫn 401: kết thúc phiên, không lặp refresh vô hạn.
        tokenStore.clear();
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
    // Logout vẫn phải chạy khi refresh đang chờ bị từ chối hoặc mất mạng.
    await refreshing?.catch(() => undefined);
  },
  raw: client,
};
