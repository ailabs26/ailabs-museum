export function formatAudioTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  const tail = `${String(minutes % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return total >= 3600 ? `${String(Math.floor(total / 3600)).padStart(2, '0')}:${tail}` : tail;
}

export function getSeekDuration(duration: number): number | null {
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function clampAudioTime(seconds: number, duration: number): number {
  return Number.isFinite(seconds) && getSeekDuration(duration) !== null
    ? Math.min(duration, Math.max(0, seconds)) : 0;
}
