import Constants from 'expo-constants';

/**
 * Đọc cấu hình runtime từ `app.config.ts` (extra) — MOB-E1-04.
 * Tập trung một nơi để service/API dùng, tránh rải rác `process.env`.
 */
export type AppEnv = 'development' | 'staging' | 'production';

interface AppConfig {
  appEnv: AppEnv;
  apiUrl: string;
  isProduction: boolean;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<{ appEnv: AppEnv; apiUrl: string }>;

const appEnv: AppEnv = extra.appEnv ?? 'development';

export const appConfig: AppConfig = {
  appEnv,
  apiUrl: extra.apiUrl ?? 'http://localhost:3000/api',
  isProduction: appEnv === 'production',
};
