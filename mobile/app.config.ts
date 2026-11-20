import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * App config động theo môi trường (E1-04).
 * Chọn env qua biến `APP_ENV` (development | staging | production).
 * API base URL đọc từ `EXPO_PUBLIC_API_URL` hoặc mặc định theo env.
 */
type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV as AppEnv) ?? 'development';

const API_URL_BY_ENV: Record<AppEnv, string> = {
  development: 'http://localhost:3000/api',
  staging: 'https://staging.aura-museum.example/api',
  production: 'https://api.aura-museum.example/api',
};

const NAME_SUFFIX: Record<AppEnv, string> = {
  development: ' (Dev)',
  staging: ' (Staging)',
  production: '',
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Aura Museum${NAME_SUFFIX[APP_ENV]}`,
  slug: 'aura-museum-mobile',
  scheme: 'auramuseum',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0F766E',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.auramuseum.mobile',
  },
  android: {
    package: 'com.auramuseum.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0F766E',
    },
  },
  plugins: [
    'expo-router',
    [
      '@reactvision/react-viro',
      {
        android: {
          xRMode: ['AR'],
        },
        ios: {
          cameraUsagePermission:
            'Aura Museum cần quyền camera để đặt và quan sát hiện vật 3D trong không gian thực (AR).',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appEnv: APP_ENV,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? API_URL_BY_ENV[APP_ENV],
    // eas: { projectId: '<điền sau khi tạo EAS project>' },
  },
});
