import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { ApiException } from '@/core/api/api-error';

/**
 * TanStack Query + lưu cache offline (MOB-E3-02).
 *
 * Cache được ghi vào AsyncStorage (web: localStorage) nên dữ liệu đã tải sống qua lần mở lại app.
 * `gcTime` phải >= `PERSIST_MAX_AGE_MS`, nếu không query bị dọn khỏi bộ nhớ trước khi kịp lưu.
 */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const QUERY_CACHE_STORAGE_KEY = 'aura.query-cache';
const MAX_RETRIES = 2;

/**
 * Tiền tố key cho dữ liệu riêng của người dùng đã đăng nhập (vd `['session', 'reports']`).
 * Không bao giờ ghi ra đĩa và bị xóa khi đăng xuất; dữ liệu public giữ lại để xem offline.
 */
export const SESSION_QUERY_KEY = ['session'] as const;

/** Dữ liệu nhạy cảm (vd hồ sơ người dùng) đặt `meta: { persist: false }` để không ghi ra đĩa. */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { persist?: boolean };
  }
}

/**
 * Chỉ thử lại lỗi tạm thời (mất mạng, 5xx, 408, 429); 4xx khác là lỗi của request, thử lại vô ích.
 * Lịch backoff chi tiết làm ở task Retry/backoff (MOB-E12-03).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  // http-client luôn ném ApiException; lỗi khác (parse dữ liệu, bug) thử lại cũng không khỏi.
  if (failureCount >= MAX_RETRIES || !(error instanceof ApiException) || error.isCanceled)
    return false;
  const { status } = error;
  return error.isNetworkError || status >= 500 || status === 408 || status === 429;
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: PERSIST_MAX_AGE_MS,
        retry: shouldRetry,
      },
      mutations: { retry: false },
    },
  });
  client.setQueryDefaults(SESSION_QUERY_KEY, { meta: { persist: false } });
  return client;
}

/** Client dùng chung toàn app (auth cần gọi `queryClient.clear()` khi đăng xuất). */
export const queryClient = createQueryClient();

/** Chỉ lưu query thành công và không bị đánh dấu `persist: false`. */
export function shouldPersistQuery(query: Query): boolean {
  return query.state.status === 'success' && query.meta?.persist !== false;
}

export function createPersistOptions(
  storage = AsyncStorage,
  buster = Constants.expoConfig?.version ?? 'dev',
): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createAsyncStoragePersister({
      storage,
      key: QUERY_CACHE_STORAGE_KEY,
      throttleTime: 1000,
    }),
    maxAge: PERSIST_MAX_AGE_MS,
    // Đổi phiên bản app -> bỏ cache cũ (cấu trúc dữ liệu có thể đã đổi).
    buster,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}
