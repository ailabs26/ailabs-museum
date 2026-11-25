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

module.exports = config;
