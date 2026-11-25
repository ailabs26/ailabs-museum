// Cấu hình Metro cho Three.js, @react-three/fiber/native và tài nguyên 3D (.glb/.gltf) — MOB-E6-01.
// getSentryExpoConfig = getDefaultConfig của Expo + mã định danh để Sentry khớp sourcemap (MOB-E13-01).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const extraSourceExts = ['cjs', 'mjs'];
const extraAssetExts = ['glb', 'gltf', 'bin'];

config.resolver = config.resolver ?? {};
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), ...extraSourceExts]),
);
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts ?? []), ...extraAssetExts]),
);

// Quay màn hình web của Sentry: app không dùng (MOB-E11-03). Tùy chọn includeWebReplay của SDK 6.10 không có
// tác dụng vì so tên gói cũ `@sentry/replay`.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^@sentry-internal\/replay(-canvas)?$/.test(moduleName)) return { type: 'empty' };
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
