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

/** Chỉ hàm dịch, không cần provider ngôn ngữ: dùng cho component dùng chung với trang admin (ở đó trả chữ dự phòng). */
export function usePublicT(): Translator {
  return useContext(PublicTranslationsContext);
}

/** Lỗi từ service viết bằng tiếng Việt: tiếng Việt giữ câu chi tiết, ngôn ngữ khác hiện câu chung đã dịch. */
export function usePublicErrorText(): (error: Error) => string {
  const { locale, t } = usePublicLocale();
  return (error) => (locale === SOURCE_LOCALE
    ? error.message
    : t('ui.common.load-failed-detail', 'Vui lòng kiểm tra kết nối rồi thử lại.'));
}
