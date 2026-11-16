export function guidedTour2dDetailPath(roomSlug: string, exhibitId: string): string {
  return `/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(exhibitId)}`;
}

export function guidedTour3dPath(roomSlug: string, exhibitId: string): string {
  return `/tour?${new URLSearchParams({ room: roomSlug, exhibit: exhibitId })}`;
}
