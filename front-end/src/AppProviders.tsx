import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/app/theme';
import { queryClient } from '@/core/api/query-client';
import { AuthProvider } from '@/core/auth/auth.context';
import { ErrorBoundary, GlobalLoadingBar } from '@/shared/components/feedback';

/** Gộp toàn bộ provider cấp ứng dụng theo đúng thứ tự. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ModalsProvider>
              <Notifications position="top-right" />
              <GlobalLoadingBar />
              <BrowserRouter>{children}</BrowserRouter>
            </ModalsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </MantineProvider>
  );
}
