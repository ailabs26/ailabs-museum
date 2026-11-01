/**
 * VT-079 — hàng đợi lưu nháp tự động (không phụ thuộc React để test bằng fake timers).
 *
 * - Chỉ gửi sau khi ngừng thay đổi `delayMs`; mỗi lúc tối đa 1 request in-flight.
 * - Thay đổi trong lúc chờ chỉ giữ snapshot mới nhất, gửi tiếp bằng version server vừa trả.
 * - 409 (bản mới hơn đã có trên server) → dừng hẳn, không bao giờ tự gửi lại để ghi đè.
 * - Lỗi khác → giữ snapshot, thử lại sau `retryDelayMs` với CÙNG version (chưa ghi được gì).
 */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface DraftAutosaverOptions<T> {
  initialVersion: number;
  /** Snapshot đang có trên server; trùng thì không gửi. */
  initialSnapshot?: T;
  delayMs?: number;
  retryDelayMs?: number;
  save: (snapshot: T, expectedVersion: number) => Promise<{ version: number }>;
  isConflict: (error: unknown) => boolean;
  onStatus?: (status: AutosaveStatus) => void;
  onSaved?: (result: { version: number }) => void;
}

export function createDraftAutosaver<T>(options: DraftAutosaverOptions<T>) {
  const { delayMs = 1500, retryDelayMs = 5000 } = options;
  let version = options.initialVersion;
  let lastSaved = options.initialSnapshot === undefined ? undefined : JSON.stringify(options.initialSnapshot);
  let pending: T | undefined;
  let inFlight = false;
  let status: AutosaveStatus = 'idle';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const setStatus = (next: AutosaveStatus) => {
    status = next;
    options.onStatus?.(next);
  };
  const stopped = () => disposed || status === 'conflict';

  function arm(ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, ms);
  }

  async function flush() {
    if (stopped() || inFlight || pending === undefined) return;
    const snapshot = pending;
    pending = undefined;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSaved) return;

    inFlight = true;
    setStatus('saving');
    try {
      const result = await options.save(snapshot, version);
      if (disposed) return;
      version = result.version;
      lastSaved = serialized;
      setStatus('saved');
      options.onSaved?.(result);
    } catch (error) {
      if (disposed) return;
      if (options.isConflict(error)) {
        pending = undefined;
        setStatus('conflict');
        return;
      }
      // Chưa ghi được: snapshot mới hơn (nếu có) thay thế, version giữ nguyên.
      pending ??= snapshot;
      setStatus('error');
      arm(retryDelayMs);
      return;
    } finally {
      inFlight = false;
    }
    if (pending !== undefined) void flush();
  }

  return {
    schedule(snapshot: T) {
      if (stopped()) return;
      pending = snapshot;
      if (!inFlight) arm(delayMs);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      pending = undefined;
    },
    get version() { return version; },
    get status() { return status; },
  };
}

export type DraftAutosaver<T> = ReturnType<typeof createDraftAutosaver<T>>;
