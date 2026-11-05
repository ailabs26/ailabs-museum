import { describe, expect, it } from 'vitest';
import {
  createPublicLocaleStore,
  DEFAULT_PUBLIC_LOCALE,
  PUBLIC_LOCALE_STORAGE_KEY,
  publicLocaleSchema,
} from './publicLocale';
import { LOCALES } from '@/services/translations.service';

function memoryStorage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[PUBLIC_LOCALE_STORAGE_KEY, initial]]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('public locale persistence', () => {
  it('accepts the public UI locales and defaults to vi', () => {
    expect(DEFAULT_PUBLIC_LOCALE).toBe('vi');
    for (const { code } of LOCALES) {
      expect(publicLocaleSchema.safeParse(code).success).toBe(true);
    }
    for (const value of ['de', '', 1]) {
      expect(publicLocaleSchema.safeParse(value).success).toBe(false);
    }
  });

  it('migrates a saved locale from the previous public key', () => {
    const values = new Map([['aura:public-locale', 'en']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const store = createPublicLocaleStore(() => storage);

    expect(store.getSnapshot()).toEqual({ value: 'en', error: null });
    expect(storage.getItem(PUBLIC_LOCALE_STORAGE_KEY)).toBe('{"version":1,"value":"en"}');
  });

  it('reads a valid saved locale and uses the versioned visitor key', () => {
    const storage = memoryStorage('{"version":1,"value":"en"}');
    const store = createPublicLocaleStore(() => storage);

    expect(PUBLIC_LOCALE_STORAGE_KEY).toBe('aura:visitor:locale:v1');
    expect(store.getSnapshot()).toEqual({ value: 'en', error: null });
  });

  it('uses vi without an error when no locale has been saved', () => {
    const store = createPublicLocaleStore(() => memoryStorage());
    expect(store.getSnapshot()).toEqual({ value: 'vi', error: null });
  });

  it.each([
    '{',
    '{"version":2,"value":"en"}',
    '{"version":1,"value":"de"}',
    '{"version":1,"value":1}',
  ])('falls back to vi for invalid saved data (%#)', (saved) => {
    const store = createPublicLocaleStore(() => memoryStorage(saved));
    expect(store.getSnapshot()).toEqual({ value: 'vi', error: 'invalid' });
  });

  it('uses vi when storage cannot be read', () => {
    const store = createPublicLocaleStore(() => { throw new Error('blocked'); });
    expect(store.getSnapshot()).toEqual({ value: 'vi', error: 'unavailable' });
  });

  it('keeps a locale change in memory when storage cannot be written', () => {
    const store = createPublicLocaleStore(() => ({
      getItem: () => null,
      setItem: () => { throw new Error('blocked'); },
    }));

    expect(store.update(() => 'en')).toBe(false);
    expect(store.getSnapshot()).toEqual({ value: 'en', error: 'unavailable' });
  });
});
