import type { MuseumDisplay } from '@/interfaces/museumScene';

/** Public display copy only; never index IDs, model URLs or revision metadata. */
export function normalizeExhibitSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function createExhibitSearchIndex(displays: readonly MuseumDisplay[]) {
  return displays.map((display, order) => ({ display, order,
    title: normalizeExhibitSearch(display.title), description: normalizeExhibitSearch(display.description),
    labels: (display.hotspots ?? []).map(hotspot => normalizeExhibitSearch(hotspot.label)),
  }));
}

/** Deterministic field ranking, then the published display order supplied by mapRoomDisplays. */
export function searchExhibits(index: ReturnType<typeof createExhibitSearchIndex>, query: string): MuseumDisplay[] {
  const normalized = normalizeExhibitSearch(query);
  if (!normalized) return index.map(entry => entry.display);
  const terms = normalized.split(' ');
  const matches = (field: string) => terms.every(term => field.includes(term));
  return index.flatMap(entry => {
    const rank = entry.title === normalized ? 0 : entry.title.startsWith(normalized) ? 1
      : matches(entry.title) ? 2 : matches(entry.description) ? 3 : entry.labels.some(matches) ? 4 : -1;
    return rank < 0 ? [] : [{ ...entry, rank }];
  }).sort((a, b) => a.rank - b.rank || a.order - b.order || (a.display.id < b.display.id ? -1 : a.display.id > b.display.id ? 1 : 0))
    .map(entry => entry.display);
}
