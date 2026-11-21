// Cấu hình Metro cho Three.js, @react-three/fiber/native và tài nguyên 3D (.glb/.gltf) — MOB-E6-01.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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
