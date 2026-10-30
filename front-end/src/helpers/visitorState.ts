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

export const favoritesStore = createVisitorStore('aura:visitor:favorites:v1', favoriteRefsSchema, []);
export const recentStore = createVisitorStore('aura:visitor:recent:v1', recentRefsSchema, []);
export const readingStore = createVisitorStore('aura:visitor:reading:v1', readingPreferencesSchema, DEFAULT_READING);
export const notesStore = createVisitorStore('aura:visitor:notes:v1', noteEntriesSchema, []);

export function toggleFavorite(refs: VisitorExhibitRef[], ref: VisitorExhibitRef) {
  return refs.some(item => isSameExhibit(item, ref)) ? refs.filter(item => !isSameExhibit(item, ref)) : [...refs, ref];
}

export function rememberExhibit(refs: VisitorExhibitRef[], ref: VisitorExhibitRef) {
  return [ref, ...refs.filter(item => !isSameExhibit(item, ref))].slice(0, 20);
}
