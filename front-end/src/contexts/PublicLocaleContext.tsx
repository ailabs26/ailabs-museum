import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { publicLocaleStore, type PublicLocale } from '@/helpers/publicLocale';
import type { VisitorStorageError } from '@/helpers/visitorPersistence';
import { useVisitorStore } from '@/hooks/useVisitorStore';

export interface PublicLocaleContextValue {
  locale: PublicLocale;
  setLocale: (next: PublicLocale) => void;
  storageError: VisitorStorageError;
}

export const PublicLocaleContext = createContext<PublicLocaleContextValue | null>(null);

export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const { value: locale, error: storageError } = useVisitorStore(publicLocaleStore);
  const setLocale = useCallback((next: PublicLocale) => { publicLocaleStore.update(() => next); }, []);
  const value = useMemo(() => ({ locale, setLocale, storageError }), [locale, setLocale, storageError]);

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}
