import Constants from 'expo-constants';
import {
  resolveFeatureFlags,
  type AppEnv,
  type FeatureFlag,
  type FeatureFlags,
} from './feature-flags';

/**
 * Đọc cấu hình runtime từ `app.config.ts` (extra) — MOB-E1-04, MOB-E3-04.
 * Tập trung một nơi để service/API dùng, tránh rải rác `process.env`.
 */
export type { AppEnv, FeatureFlag, FeatureFlags };

interface AppConfig {
  appEnv: AppEnv;
  apiUrl: string;
  isProduction: boolean;
  /** Rỗng khi chưa cấu hình (EAS secret) — Sentry không khởi tạo. */
  sentryDsn: string | null;
  featureFlags: FeatureFlags;
}

interface ExpoExtra {
  appEnv: AppEnv;
  apiUrl: string;
  sentryDsn: string;
  featureFlagOverrides: Record<string, unknown>;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<ExpoExtra>;

const appEnv: AppEnv = extra.appEnv ?? 'development';

export const appConfig: AppConfig = {
  appEnv,
  apiUrl: extra.apiUrl ?? 'http://localhost:3000/api',
  isProduction: appEnv === 'production',
  sentryDsn: extra.sentryDsn?.trim() || null,
  featureFlags: resolveFeatureFlags(appEnv, extra.featureFlagOverrides),
};

/** Flag cố định theo bản build; đổi bằng biến `EXPO_PUBLIC_FLAG_*` khi build/OTA. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return appConfig.featureFlags[flag];
}
