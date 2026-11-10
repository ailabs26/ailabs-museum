export function guidedTour2dDetailPath(roomSlug: string, exhibitId: string): string {
  return `/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(exhibitId)}`;
}
