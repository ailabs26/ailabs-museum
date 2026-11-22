/**
 * Feature flags (MOB-E3-04) — logic thuần, không phụ thuộc React Native để test được.
 *
 * Mặc định theo môi trường; ghi đè lúc build bằng biến `EXPO_PUBLIC_FLAG_<TÊN_FLAG>`
 * (ví dụ `EXPO_PUBLIC_FLAG_OFFLINE_PREFETCH=true`). `app.config.ts` gom các biến này vào
 * `extra.featureFlagOverrides`, `env.ts` gọi `resolveFeatureFlags` để ra giá trị cuối.
 */
export type AppEnv = 'development' | 'staging' | 'production';

export const FEATURE_FLAGS = ['scene3d', 'ar', 'analytics', 'offlinePrefetch'] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];
export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

/** Tính năng rủi ro cao (AR) chỉ bật sẵn ở dev; analytics tắt ở dev để không gửi sự kiện rác. */
const DEFAULT_FLAGS: Record<AppEnv, FeatureFlags> = {
  development: { scene3d: true, ar: true, analytics: false, offlinePrefetch: true },
  staging: { scene3d: true, ar: false, analytics: true, offlinePrefetch: true },
  production: { scene3d: true, ar: false, analytics: true, offlinePrefetch: false },
};

/** `offlinePrefetch` -> `OFFLINE_PREFETCH` (hậu tố của biến môi trường). */
export function flagEnvSuffix(flag: FeatureFlag): string {
  return flag.replace(/([A-Z])/g, '_$1').toUpperCase();
}

/** Chỉ nhận chuỗi boolean rõ ràng; giá trị khác bị bỏ qua để không vô tình bật tính năng. */
function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

/**
 * Gộp mặc định theo env với ghi đè.
 * @param overrides khóa là hậu tố biến môi trường (`OFFLINE_PREFETCH`) hoặc tên flag (`offlinePrefetch`).
 */
export function resolveFeatureFlags(
  appEnv: AppEnv,
  overrides: Readonly<Record<string, unknown>> = {},
): FeatureFlags {
  const flags: Record<FeatureFlag, boolean> = { ...DEFAULT_FLAGS[appEnv] };
  for (const flag of FEATURE_FLAGS) {
    const value = parseBoolean(overrides[flagEnvSuffix(flag)] ?? overrides[flag]);
    if (value !== undefined) flags[flag] = value;
  }
  return flags;
}
