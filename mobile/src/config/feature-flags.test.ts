import { FEATURE_FLAGS, flagEnvSuffix, resolveFeatureFlags } from './feature-flags';

describe('resolveFeatureFlags', () => {
  it('trả đủ mọi flag theo mặc định môi trường', () => {
    const flags = resolveFeatureFlags('production');
    expect(Object.keys(flags).sort()).toEqual([...FEATURE_FLAGS].sort());
    expect(flags.ar).toBe(false);
    expect(resolveFeatureFlags('development').ar).toBe(true);
  });

  it('ghi đè bằng hậu tố biến môi trường hoặc tên flag', () => {
    const flags = resolveFeatureFlags('production', { OFFLINE_PREFETCH: 'true', ar: '1', ANALYTICS: 'false' });
    expect(flags.offlinePrefetch).toBe(true);
    expect(flags.ar).toBe(true);
    expect(flags.analytics).toBe(false);
  });

  it('bỏ qua giá trị không phải boolean rõ ràng', () => {
    const flags = resolveFeatureFlags('production', { AR: 'yes', SCENE3D: '', OFFLINE_PREFETCH: 42 });
    expect(flags).toEqual(resolveFeatureFlags('production'));
  });
});

describe('flagEnvSuffix', () => {
  it('đổi camelCase sang SCREAMING_SNAKE', () => {
    expect(flagEnvSuffix('offlinePrefetch')).toBe('OFFLINE_PREFETCH');
    expect(flagEnvSuffix('scene3d')).toBe('SCENE3D');
  });
});
