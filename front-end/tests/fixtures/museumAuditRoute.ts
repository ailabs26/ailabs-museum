/** Normalized input offsets at a monotonic elapsed time, independent of driver roundtrip rate. */
export function getAuditNavigationInput(elapsedMs: number) {
  return {
    key: Math.floor(elapsedMs / 2000) % 2 === 0 ? 'a' : 'd',
    lookX: Math.sin(elapsedMs / 200) * .12,
    lookY: Math.sin(elapsedMs / 533.333) * .03,
  };
}
