import { z } from 'zod';
import { LOCALES } from '@/services/translations.service';
import { createVisitorStore } from './visitorPersistence';

export const PUBLIC_LOCALE_STORAGE_KEY = 'aura:visitor:locale:v1';
export const DEFAULT_PUBLIC_LOCALE = 'vi' as const;
const LEGACY_PUBLIC_LOCALE_STORAGE_KEY = 'aura:public-locale';
export const publicLocaleSchema = z.string().refine((value) => LOCALES.some((locale) => locale.code === value));
export type PublicLocale = z.infer<typeof publicLocaleSchema>;

export function createPublicLocaleStore(getStorage?: () => Pick<Storage, 'getItem' | 'setItem'>) {
  const getCompatibleStorage = () => {
    const storage = getStorage ? getStorage() : window.localStorage;
    return {
      getItem(key: string) {
        const current = storage.getItem(key);
        if (current !== null || key !== PUBLIC_LOCALE_STORAGE_KEY) return current;
        const legacy = publicLocaleSchema.safeParse(storage.getItem(LEGACY_PUBLIC_LOCALE_STORAGE_KEY));
        if (!legacy.success) return null;
        const migrated = JSON.stringify({ version: 1, value: legacy.data });
        try { storage.setItem(key, migrated); } catch { /* Keep the saved locale usable in memory. */ }
        return migrated;
      },
      setItem: (key: string, value: string) => storage.setItem(key, value),
    };
  };

  return createVisitorStore(PUBLIC_LOCALE_STORAGE_KEY, publicLocaleSchema, DEFAULT_PUBLIC_LOCALE, getCompatibleStorage);
}

export const publicLocaleStore = createPublicLocaleStore();

/**
 * Ngôn ngữ đầu tiên của máy khách mà trang hỗ trợ (`ko-KR` → `ko`, `zh-Hans-CN` → `zh`); không khớp thì tiếng Việt.
 * Dùng khi khách vào qua mã QR mà chưa từng chọn ngôn ngữ.
 */
export function detectPublicLocale(languages: readonly string[]): PublicLocale {
  for (const language of languages) {
    const code = language.toLowerCase().split('-')[0];
    if (LOCALES.some((locale) => locale.code === code)) return code;
  }
  return DEFAULT_PUBLIC_LOCALE;
}

/** Khách đã từng chọn ngôn ngữ trên máy này chưa (kể cả khóa lưu cũ). Không đọc được bộ nhớ thì coi như đã chọn. */
export function hasSavedPublicLocale(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): boolean {
  try {
    return !storage || storage.getItem(PUBLIC_LOCALE_STORAGE_KEY) !== null || storage.getItem(LEGACY_PUBLIC_LOCALE_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

