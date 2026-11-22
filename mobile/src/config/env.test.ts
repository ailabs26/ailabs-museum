// jest.mock được hoist lên trước import nên env.ts đọc extra đã mock.
import { appConfig, isFeatureEnabled } from './env';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        appEnv: 'staging',
        apiUrl: 'https://staging.example/api',
        sentryDsn: '  ',
        featureFlagOverrides: { AR: 'true' },
      },
    },
  },
}));

describe('appConfig', () => {
  it('đọc extra của app.config và áp ghi đè flag', () => {
    expect(appConfig.appEnv).toBe('staging');
    expect(appConfig.apiUrl).toBe('https://staging.example/api');
    expect(appConfig.isProduction).toBe(false);
    expect(isFeatureEnabled('ar')).toBe(true);
  });

  it('DSN rỗng -> null (không khởi tạo Sentry)', () => {
    expect(appConfig.sentryDsn).toBeNull();
  });
});
