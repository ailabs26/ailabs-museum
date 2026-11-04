import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/core/api/http-client';
import { LOCALES, SOURCE_LOCALE } from '@/services/translations.service';

const STORAGE_KEY = 'aura:public-locale';

interface PublicLocaleValue {
  locale: string;
  setLocale: (locale: string) => void;
  /** Chuỗi giao diện theo ngôn ngữ đang chọn; chưa dịch hoặc chưa tải xong thì dùng `fallback` (tiếng Việt). */
  t: (key: string, fallback: string) => string;
}

const PublicLocaleContext = createContext<PublicLocaleValue>({
  locale: SOURCE_LOCALE, setLocale: () => undefined, t: (_key, fallback) => fallback,
});

function savedLocale(): string {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LOCALES.some((locale) => locale.code === value) ? value! : SOURCE_LOCALE;
  } catch {
    return SOURCE_LOCALE; // localStorage bị chặn: dùng ngôn ngữ nguồn.
  }
}

/** Ngôn ngữ của phần công khai: lưu trên trình duyệt, đồng bộ `<html lang>`, chuỗi lấy từ CMS (loại `ui`). */
export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(savedLocale);
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

  const setLocale = useCallback((next: string) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Không lưu được thì chỉ áp dụng cho phiên hiện tại.
    }
  }, []);

  const value = useMemo<PublicLocaleValue>(() => {
    const map = locale === SOURCE_LOCALE ? undefined : strings.data;
    return { locale, setLocale, t: (key, fallback) => map?.[key] || fallback };
  }, [locale, setLocale, strings.data]);

  return <PublicLocaleContext.Provider value={value}>{children}</PublicLocaleContext.Provider>;
}

export const usePublicLocale = () => useContext(PublicLocaleContext);
