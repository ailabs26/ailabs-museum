import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/core/api/http-client';
import { SOURCE_LOCALE } from '@/services/translations.service';
import { PublicLocaleProvider as StoredLocaleProvider } from '@/contexts/PublicLocaleContext';
import { usePublicLocale as useStoredLocale } from '@/hooks/usePublicLocale';

type Translator = (key: string, fallback: string) => string;
const PublicTranslationsContext = createContext<Translator>((_key, fallback) => fallback);

/** Ngôn ngữ của phần công khai: lưu trên trình duyệt, đồng bộ `<html lang>`, chuỗi lấy từ CMS (loại `ui`). */
export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  return <StoredLocaleProvider><PublicTranslationsProvider>{children}</PublicTranslationsProvider></StoredLocaleProvider>;
}

function PublicTranslationsProvider({ children }: { children: ReactNode }) {
  const { locale } = useStoredLocale();
  const strings = useQuery({
    queryKey: ['public-translations', locale],
    queryFn: () => http.get<Record<string, string>>('/public/translations', { params: { locale } }),
    enabled: locale !== SOURCE_LOCALE,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = SOURCE_LOCALE; };
  }, [locale]);

  const t = useMemo<Translator>(() => {
    const map = locale === SOURCE_LOCALE ? undefined : strings.data;
    return (key, fallback) => map?.[key] || fallback;
  }, [locale, strings.data]);

  return <PublicTranslationsContext.Provider value={t}>{children}</PublicTranslationsContext.Provider>;
}

export function usePublicLocale() {
  return { ...useStoredLocale(), t: useContext(PublicTranslationsContext) };
}
