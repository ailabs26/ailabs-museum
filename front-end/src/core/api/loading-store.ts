/**
 * Store đếm số request HTTP đang chạy để hiển thị loading toàn cục.
 * Ý tưởng từ SpinnerHandlerService (dự án tham khảo) nhưng triển khai thuần React
 * qua useSyncExternalStore, không phụ thuộc framework.
 */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const loadingStore = {
  start() {
    pending += 1;
    emit();
  },
  done() {
    pending = Math.max(0, pending - 1);
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** true khi có ít nhất một request đang chạy. */
  getSnapshot(): boolean {
    return pending > 0;
  },
};
