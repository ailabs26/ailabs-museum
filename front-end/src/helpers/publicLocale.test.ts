import { describe, expect, it } from 'vitest';
import {
  createPublicLocaleStore,
  DEFAULT_PUBLIC_LOCALE,
  PUBLIC_LOCALE_STORAGE_KEY,
  publicLocaleSchema,
} from './publicLocale';

function memoryStorage(initial?: string) {
  const values = new Map(initial === undefined ? [] : [[PUBLIC_LOCALE_STORAGE_KEY, initial]]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('public locale persistence', () => {
  it('accepts only vi and en and defaults to vi', () => {
    expect(DEFAULT_PUBLIC_LOCALE).toBe('vi');
    expect(publicLocaleSchema.safeParse('vi').success).toBe(true);
    expect(publicLocaleSchema.safeParse('en').success).toBe(true);
    for (const value of ['fr', 'ja', '', 1]) {
      expect(publicLocaleSchema.safeParse(value).success).toBe(false);
    }
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
    '{"version":1,"value":"fr"}',
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
