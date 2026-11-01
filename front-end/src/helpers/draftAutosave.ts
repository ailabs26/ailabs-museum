/** VT-079 — hàng đợi lưu nháp tự động. Stub cho bước RED: chưa có hành vi. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface DraftAutosaverOptions<T> {
  initialVersion: number;
  initialSnapshot?: T;
  delayMs?: number;
  retryDelayMs?: number;
  save: (snapshot: T, expectedVersion: number) => Promise<{ version: number }>;
  isConflict: (error: unknown) => boolean;
  onStatus?: (status: AutosaveStatus) => void;
}

export function createDraftAutosaver<T>(_options: DraftAutosaverOptions<T>) {
  return {
    schedule(snapshot: T) { void snapshot; },
    dispose() {},
    get version() { return _options.initialVersion; },
    get status(): AutosaveStatus { return 'idle'; },
  };
}
