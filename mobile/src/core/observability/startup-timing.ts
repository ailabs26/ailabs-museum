import { useEffect } from 'react';

/**
 * Đo thời gian khởi động phía JS (MOB-E11-03): từ lúc bundle bắt đầu chạy tới khi khung app dựng xong lần đầu.
 * Không gồm phần native trước đó (nạp app, khởi tạo Hermes) — cold start đầy đủ đo bằng công cụ của hệ điều hành,
 * xem docs/plans/261118-mobile-expo-visitor-app/performance.md.
 */
interface BundleGlobals {
  /** Metro đặt ở dòng đầu bundle, cùng đồng hồ với `nativePerformanceNow` (không có thì `Date.now`). */
  __BUNDLE_START_TIME__?: number;
  nativePerformanceNow?: () => number;
}
const globals = globalThis as BundleGlobals;
const clock = () => globals.nativePerformanceNow?.() ?? Date.now();

let startupMs: number | null = null;

export function getStartupMs(): number | null {
  return startupMs;
}

export function recordStartup(now = clock(), bundleStart = globals.__BUNDLE_START_TIME__ ?? null): number | null {
  if (startupMs !== null || bundleStart === null) return startupMs;
  startupMs = Math.max(0, Math.round(now - bundleStart));
  // eslint-disable-next-line no-console
  if (__DEV__ && process.env.NODE_ENV !== 'test') console.log(`[startup] ${startupMs} ms (JS)`);
  return startupMs;
}

/** Đặt ở layout gốc: ghi một lần sau khung hình đầu tiên. */
export function useStartupTiming(): void {
  useEffect(() => {
    const frame = requestAnimationFrame(() => recordStartup());
    return () => cancelAnimationFrame(frame);
  }, []);
}
