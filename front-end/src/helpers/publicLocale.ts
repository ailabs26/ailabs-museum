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
