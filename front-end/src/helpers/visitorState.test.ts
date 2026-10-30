import { expect, it } from 'vitest';
import { favoriteRefsSchema, noteEntriesSchema, readingPreferencesSchema, recentRefsSchema, rememberExhibit, toggleFavorite } from './visitorState';

const ref = { roomId: '00000000-0000-4000-8000-000000000001', exhibitId: '10000000-0000-4000-8000-000000000001' };

it('toggles favorites by room/exhibit identity and validates identifiers and uniqueness', () => {
  expect(toggleFavorite([], ref)).toEqual([ref]);
  expect(toggleFavorite([ref], ref)).toEqual([]);
  expect(favoriteRefsSchema.safeParse([{ ...ref, roomId: 'bad' }]).success).toBe(false);
  expect(favoriteRefsSchema.safeParse([ref, ref]).success).toBe(false);
  expect(favoriteRefsSchema.safeParse([{ ...ref, name: 'API copy' }]).success).toBe(false);
});

it('moves the viewed exhibit first without duplication and keeps only 20 recent refs', () => {
  const refs = Array.from({ length: 20 }, (_, i) => ({ ...ref, exhibitId: `10000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}` }));
  const next = rememberExhibit(refs, ref);
  expect(next).toHaveLength(20);
  expect(next[0]).toEqual(ref);
  expect(next[19].exhibitId).toBe('10000000-0000-4000-8000-000000000020');
  expect(rememberExhibit(next, ref)).toEqual(next);
  expect(recentRefsSchema.safeParse([...refs, ref]).success).toBe(false);
});

it('bounds reading settings and rejects invalid browser data', () => {
  for (const fontScale of [0, 0.9, 1.6, NaN]) expect(readingPreferencesSchema.safeParse({ enabled: true, fontScale }).success).toBe(false);
  expect(readingPreferencesSchema.parse({ enabled: true, fontScale: 1.5 })).toEqual({ enabled: true, fontScale: 1.5 });
  expect(readingPreferencesSchema.safeParse({ enabled: 'yes', fontScale: 1 }).success).toBe(false);
});

it('bounds plain text notes and prevents ambiguous duplicate identities', () => {
  expect(noteEntriesSchema.safeParse([{ ...ref, text: '<script>text only</script>' }]).success).toBe(true);
  expect(noteEntriesSchema.safeParse([{ ...ref, text: 'x'.repeat(2001) }]).success).toBe(false);
  expect(noteEntriesSchema.safeParse([{ ...ref, text: 'a' }, { ...ref, text: 'b' }]).success).toBe(false);
});
