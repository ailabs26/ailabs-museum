import type { MuseumDisplay } from './museumTypes';

export interface HotspotStorySelection {
  roomId: string;
  exhibitId: string;
  hotspotId: string;
  issuedAt: number;
}

export type SelectHotspot = (exhibitId: string, hotspotId: string) => void;

export function resolveHotspotStory(
  selection: HotspotStorySelection | null,
  display?: MuseumDisplay,
) {
  const hotspots = display?.hotspots;
  if (
    !selection ||
    !display ||
    !hotspots ||
    selection.roomId !== display.roomId ||
    selection.exhibitId !== display.id
  ) return null;

  const index = hotspots.findIndex((hotspot) => hotspot.id === selection.hotspotId);
  return index === -1 ? null : { hotspot: hotspots[index]!, hotspots, index };
}
