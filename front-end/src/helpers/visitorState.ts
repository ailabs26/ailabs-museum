import { z } from 'zod';
import { createVisitorStore } from './visitorPersistence';

const exhibitRefSchema = z.object({ roomId: z.string().uuid(), exhibitId: z.string().uuid() }).strict();
export type VisitorExhibitRef = z.infer<typeof exhibitRefSchema>;
export const exhibitRefKey = (ref: VisitorExhibitRef) => `${ref.roomId}:${ref.exhibitId}`;
export const isSameExhibit = (left: VisitorExhibitRef, right: VisitorExhibitRef) => exhibitRefKey(left) === exhibitRefKey(right);
const hasUniqueRefs = (refs: VisitorExhibitRef[]) => new Set(refs.map(exhibitRefKey)).size === refs.length;

export const favoriteRefsSchema = z.array(exhibitRefSchema).max(100).refine(hasUniqueRefs);
export const recentRefsSchema = z.array(exhibitRefSchema).max(20).refine(hasUniqueRefs);
export const readingPreferencesSchema = z.object({ enabled: z.boolean(), fontScale: z.number().finite().min(1).max(1.5) }).strict();
export const noteEntriesSchema = z.array(exhibitRefSchema.extend({ text: z.string().min(1).max(2000) }).strict()).max(100).refine(hasUniqueRefs);
export const DEFAULT_READING = { enabled: false, fontScale: 1 };

/** Reapply local changes/removals only; unrelated records saved in another tab survive retry. */
export function mergeVisitorEntries<Entry extends VisitorExhibitRef>(base: Entry[], local: Entry[], remote: Entry[]): Entry[] {
  const before = new Map(base.map(entry => [exhibitRefKey(entry), JSON.stringify(entry)]));
  const after = new Map(local.map(entry => [exhibitRefKey(entry), JSON.stringify(entry)]));
  const changed = new Set([...before.keys(), ...after.keys()].filter(key => before.get(key) !== after.get(key)));
  return [...local.filter(entry => changed.has(exhibitRefKey(entry))), ...remote.filter(entry => !changed.has(exhibitRefKey(entry)))];
}

export const favoritesStore = createVisitorStore('aura:visitor:favorites:v1', favoriteRefsSchema, [], undefined, mergeVisitorEntries);
export function mergeRecentRefs(base: VisitorExhibitRef[], local: VisitorExhibitRef[], remote: VisitorExhibitRef[]) {
  const removed = base.filter(ref => !local.some(item => isSameExhibit(item, ref)));
  // rememberExhibit moves/adds a prefix; the remaining base-order suffix was not viewed again.
  let unchangedStart = local.length;
  let baseIndex = base.length - 1;
  while (unchangedStart > 0) {
    while (baseIndex >= 0 && !isSameExhibit(base[baseIndex], local[unchangedStart - 1])) baseIndex--;
    if (baseIndex < 0) break;
    unchangedStart--;
    baseIndex--;
  }
  const changed = local.slice(0, unchangedStart);
  return [...changed, ...remote.filter(ref => ![...changed, ...removed].some(item => isSameExhibit(item, ref)))].slice(0, 20);
}
export const recentStore = createVisitorStore('aura:visitor:recent:v1', recentRefsSchema, [], undefined, mergeRecentRefs);
export const readingStore = createVisitorStore('aura:visitor:reading:v1', readingPreferencesSchema, DEFAULT_READING);
export const notesStore = createVisitorStore('aura:visitor:notes:v1', noteEntriesSchema, [], undefined, mergeVisitorEntries);

export function toggleFavorite(refs: VisitorExhibitRef[], ref: VisitorExhibitRef) {
  return refs.some(item => isSameExhibit(item, ref)) ? refs.filter(item => !isSameExhibit(item, ref)) : [...refs, ref];
}

export function rememberExhibit(refs: VisitorExhibitRef[], ref: VisitorExhibitRef) {
  return [ref, ...refs.filter(item => !isSameExhibit(item, ref))].slice(0, 20);
}
