import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/core/api/http-client';
import { SOURCE_LOCALE } from '@/services/translations.service';
import { PublicLocaleProvider as StoredLocaleProvider } from '@/contexts/PublicLocaleContext';
import { usePublicLocale as useStoredLocale } from '@/hooks/usePublicLocale';

type TranslationParams = Record<string, string | number>;
export type Translator = (key: string, fallback: string, params?: TranslationParams) => string;

/** Thay `{name}` bằng giá trị tương ứng; tham số không có thì giữ nguyên để dễ thấy. */
export function fillParams(text: string, params?: TranslationParams): string {
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : text;
}

const PublicTranslationsContext = createContext<Translator>((_key, fallback, params) => fillParams(fallback, params));

/** Ngôn ngữ của phần công khai: lưu trên trình duyệt, đồng bộ `<html lang>`, chuỗi lấy từ CMS (loại `ui`). */
export function PublicLocaleProvider({ children }: { children: ReactNode }) {
  return <StoredLocaleProvider><PublicTranslationsProvider>{children}</PublicTranslationsProvider></StoredLocaleProvider>;
}

function PublicTranslationsProvider({ children }: { children: ReactNode }) {
  const { locale } = useStoredLocale();
  const strings = useQuery({
    queryKey: ['public-translations', locale],
    queryFn: () => http.get<Record<string, string>>('/public/translations', { params: { locale } }),
    meta: { public: true },
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = SOURCE_LOCALE; };
  }, [locale]);

  // Cả tiếng Việt cũng đọc từ CMS để sửa được không cần deploy; chưa tải xong hoặc lỗi thì dùng chữ dự phòng.
  const t = useMemo<Translator>(() => (key, fallback, params) => fillParams(strings.data?.[key] || fallback, params), [strings.data]);

  return <PublicTranslationsContext.Provider value={t}>{children}</PublicTranslationsContext.Provider>;
}

export function usePublicLocale() {
  return { ...useStoredLocale(), t: useContext(PublicTranslationsContext) };
}
