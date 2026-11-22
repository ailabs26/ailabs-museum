import {
  create,
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { appConfig } from '@/config/env';
import {
  NATIVE_CLIENT_HEADERS,
  parseAuthResponse,
  sessionTokensSchema,
} from '@/core/auth/auth-schema';
import { tokenStore } from '@/core/auth/token-store';
import { apiErrorLog, toApiErrorRecord } from '@/core/observability/api-error-log';
import type { ApiResponse, Page } from './api-response';
import { ApiException, endsSession, toApiException } from './api-error';

/** Mạng di động chập chờn: đủ lâu cho 3G, không treo màn hình vô hạn. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Axios instance dùng chung cho mọi service (MOB-E3-01).
 * Mọi lỗi được chuẩn hóa thành `ApiException` ngay tại interceptor, nên tầng trên chỉ cần bắt một kiểu.
 * Gắn Bearer và tự làm mới access token khi gặp 401 (MOB-E3-03).
 */
const client = create({
  baseURL: appConfig.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  /** Đã thử lại một lần sau khi làm mới token. */
  _retried?: boolean;
  /** Phiên lúc gửi request — phiên đổi (đăng xuất/đăng nhập lại) thì không retry. */
  _sessionId?: number;
  /** Access token đã gửi kèm request. */
  _accessToken?: string | null;
  /** Thời điểm gửi lần gần nhất — để log thời lượng lỗi. */
  _startedAt?: number;
};

/** Endpoint đăng nhập/làm mới/đăng xuất: không gắn Bearer, 401 của chúng không kích hoạt refresh. */
function isAuthEndpoint(url: string | undefined): boolean {
  return /\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(url ?? '');
}

client.interceptors.request.use((config: SessionRequestConfig) => {
  config._sessionId ??= tokenStore.getSessionId();
  config._startedAt = Date.now();
  const token = isAuthEndpoint(config.url) ? null : tokenStore.getAccessToken();
  config._accessToken = token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else config.headers.delete('Authorization');
  return config;
});

// Single-flight: nhiều request 401 cùng lúc chỉ gọi /auth/refresh một lần (gửi trùng token = back-end coi là tái dùng).
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshing ??= (async () => {
    const session = tokenStore.getSessionId();
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) throw new ApiException('Phiên đăng nhập đã kết thúc', 401);
    try {
      const res = await client.post<ApiResponse<unknown>>(
        '/auth/refresh',
        { refreshToken },
        { headers: NATIVE_CLIENT_HEADERS },
      );
      const tokens = parseAuthResponse(sessionTokensSchema, res.data?.data);
      // Đăng xuất/đăng nhập lại trong lúc refresh đang chạy: bỏ token trả về.
      if (session !== tokenStore.getSessionId())
        throw new ApiException('Phiên đăng nhập đã thay đổi', 401);
      await tokenStore.rotate(tokens);
      return tokens.accessToken;
    } catch (error) {
      // Chỉ 401 mới là hết phiên; 429/5xx/mất mạng giữ refresh token để lần sau thử lại.
      if (endsSession(error) && session === tokenStore.getSessionId()) await tokenStore.clear();
      throw toApiException(error);
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

// Một lỗi chỉ ghi log một lần: request gửi lại sau refresh trả về đúng exception đã ghi ở lượt trong.
const loggedErrors = new WeakSet<ApiException>();

/** Chuẩn hóa lỗi, ghi log lỗi API tập trung (MOB-E13-03), rồi reject. Request bị hủy không phải lỗi, không ghi. */
function fail(error: unknown, config: SessionRequestConfig | undefined): Promise<never> {
  const exception = toApiException(error);
  if (config && !exception.isCanceled && !loggedErrors.has(exception)) {
    loggedErrors.add(exception);
    const requestId = isAxiosError(error) ? error.response?.headers?.['x-request-id'] : undefined;
    apiErrorLog.record(
      toApiErrorRecord(
        {
          method: config.method,
          url: config.url,
          startedAt: config._startedAt,
          requestId: typeof requestId === 'string' ? requestId : null,
        },
        exception,
      ),
    );
  }
  return Promise.reject(exception);
}

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const original = (isAxiosError(error) ? error.config : undefined) as
      SessionRequestConfig | undefined;
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (
      status === 401 &&
      original &&
      !isAuthEndpoint(original.url) &&
      original._sessionId === tokenStore.getSessionId() &&
      tokenStore.hasSession()
    ) {
      if (!original._retried) {
        original._retried = true;
        try {
          // 401 đến muộn sau khi request khác đã xoay vòng: chỉ cần gửi lại bằng token mới.
          const current = tokenStore.getAccessToken();
          if (!current || current === original._accessToken) await refreshAccessToken();
          if (original._sessionId === tokenStore.getSessionId()) return await client(original);
        } catch (retryError) {
          return fail(retryError, original);
        }
      } else if (original._accessToken === tokenStore.getAccessToken()) {
        // Vừa làm mới mà vẫn 401: phiên không còn hiệu lực, không lặp refresh vô hạn.
        await tokenStore.clear();
      }
    }
    return fail(error, original);
  },
);

/** Bóc envelope -> trả thẳng data; body rỗng (vd 204) trả undefined thay vì crash. */
function unwrap<T>(res: AxiosResponse<ApiResponse<T> | null | ''>): T {
  return (res.data || undefined)?.data as T;
}

/** Bóc envelope list -> Page<T> (gộp data + meta); thiếu meta thì coi cả danh sách là một trang. */
function unwrapPage<T>(res: AxiosResponse<ApiResponse<T[]> | null | ''>): Page<T> {
  const body = res.data || undefined;
  const items = body?.data ?? [];
  const meta = body?.meta ?? { page: 1, pageSize: items.length, total: items.length };
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
  /** Đợi refresh đang chạy (nếu có) xong — để đăng xuất gửi đúng refresh token mới nhất. */
  async waitForRefresh(): Promise<void> {
    await refreshing?.catch(() => undefined);
  },
  /** Instance gốc — để gắn interceptor (log lỗi) và adapter giả trong test. */
  raw: client,
};
