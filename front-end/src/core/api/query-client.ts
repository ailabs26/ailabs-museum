import { QueryClient } from '@tanstack/react-query';
import { ApiException } from './api-error';

/** Cấu hình react-query dùng chung: không retry lỗi 4xx, cache hợp lý. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiException && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
