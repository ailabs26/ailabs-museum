import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { createPersistOptions, queryClient } from './query-client';

/**
 * Bọc app bằng react-query có lưu cache (MOB-E3-02).
 * Trên native, "focus" = app quay lại foreground để refetch dữ liệu cũ (web đã tự theo dõi tab).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [persistOptions] = useState(createPersistOptions);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
