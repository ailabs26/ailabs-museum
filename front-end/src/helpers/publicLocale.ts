import { z } from 'zod';
import { createVisitorStore } from './visitorPersistence';

export const PUBLIC_LOCALE_STORAGE_KEY = 'aura:visitor:locale:v1';
export const DEFAULT_PUBLIC_LOCALE = 'vi' as const;
export const publicLocaleSchema = z.enum(['vi', 'en']);
export type PublicLocale = z.infer<typeof publicLocaleSchema>;

export function createPublicLocaleStore(getStorage?: () => Pick<Storage, 'getItem' | 'setItem'>) {
  return createVisitorStore(PUBLIC_LOCALE_STORAGE_KEY, publicLocaleSchema, DEFAULT_PUBLIC_LOCALE, getStorage);
}

export const publicLocaleStore = createPublicLocaleStore();
