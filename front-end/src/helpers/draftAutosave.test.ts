import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDraftAutosaver, type AutosaveStatus } from './draftAutosave';

/**
 * VT-079 — hàng đợi lưu nháp tự động. Oracle theo decision table Q1–Q5
 * (docs/bt3/VT-079/README.md), không theo implementation.
 */
type Snapshot = { name: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class ConflictError extends Error {}

function setup(initialVersion = 1, initialSnapshot: Snapshot = { name: 'Gốc' }) {
  const calls: { snapshot: Snapshot; expectedVersion: number; result: ReturnType<typeof deferred<{ version: number }>> }[] = [];
  const statuses: AutosaveStatus[] = [];
  const saver = createDraftAutosaver<Snapshot>({
    initialVersion,
    initialSnapshot,
    delayMs: 1500,
    retryDelayMs: 5000,
    save: (snapshot, expectedVersion) => {
      const result = deferred<{ version: number }>();
      calls.push({ snapshot, expectedVersion, result });
      return result.promise;
    },
    isConflict: (error) => error instanceof ConflictError,
    onStatus: (status) => statuses.push(status),
  });
  return { saver, calls, statuses };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createDraftAutosaver', () => {
  it('Q1: chỉ gửi sau khi ngừng nhập đủ delay, kèm version đang thấy', async () => {
    const { saver, calls } = setup(7);
    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(1499);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map(c => [c.snapshot.name, c.expectedVersion])).toEqual([['A', 7]]);
  });

  it('TC11 (Q2): tối đa 1 request in-flight; thay đổi trong lúc chờ gộp thành 1 lần lưu với version mới', async () => {
    const { saver, calls } = setup(1);
    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(1500);
    saver.schedule({ name: 'B' });
    saver.schedule({ name: 'C' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);

    calls[0].result.resolve({ version: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.map(c => [c.snapshot.name, c.expectedVersion])).toEqual([['A', 1], ['C', 2]]);
    calls[1].result.resolve({ version: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.version).toBe(3);
    expect(saver.status).toBe('saved');
  });

  it('TC12 (Q4): 409 → báo conflict, dừng hẳn, không bao giờ gửi lại để ghi đè', async () => {
    const { saver, calls, statuses } = setup(4);
    saver.schedule({ name: 'Bản của tôi' });
    await vi.advanceTimersByTimeAsync(1500);
    calls[0].result.reject(new ConflictError('stale'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.status).toBe('conflict');
    expect(statuses).toContain('conflict');

    saver.schedule({ name: 'Gõ tiếp sau xung đột' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
    expect(saver.version).toBe(4);
  });

  it('TC13 (Q5): lỗi mạng → giữ snapshot và thử lại với CÙNG expectedVersion', async () => {
    const { saver, calls } = setup(5);
    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(1500);
    calls[0].result.reject(new Error('Network Error'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.status).toBe('error');

    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.map(c => [c.snapshot.name, c.expectedVersion])).toEqual([['A', 5], ['A', 5]]);
    calls[1].result.resolve({ version: 6 });
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.status).toBe('saved');
    expect(saver.version).toBe(6);
  });

  it('TC13b: thay đổi mới trong lúc chờ retry được gửi thay cho snapshot lỗi, vẫn cùng version', async () => {
    const { saver, calls } = setup(5);
    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(1500);
    calls[0].result.reject(new Error('Network Error'));
    await vi.advanceTimersByTimeAsync(0);
    saver.schedule({ name: 'B' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls.map(c => [c.snapshot.name, c.expectedVersion])).toEqual([['A', 5], ['B', 5]]);
  });

  it('TC14 (Q3): snapshot giống bản đã lưu → không gửi request', async () => {
    const { saver, calls } = setup(1, { name: 'Gốc' });
    saver.schedule({ name: 'Gốc' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(0);

    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(1500);
    calls[0].result.resolve({ version: 2 });
    await vi.advanceTimersByTimeAsync(0);
    saver.schedule({ name: 'A' });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);
  });

  it('dispose: không gửi gì sau khi đóng form (kể cả timer đang chờ)', async () => {
    const { saver, calls } = setup(1);
    saver.schedule({ name: 'A' });
    saver.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(0);
  });
});
