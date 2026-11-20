import * as Device from 'expo-device';
import { Platform, UIManager } from 'react-native';

export type ArBackendEngine = 'ARKit' | 'ARCore' | 'none';

export type ArUnsupportedReason =
  | 'unsupported_platform'
  | 'emulator_not_supported'
  | 'os_too_old'
  | 'native_module_missing';

export type ArCapabilityResult =
  | {
      supported: true;
      engine: 'ARKit' | 'ARCore';
      platform: 'ios' | 'android';
      minOsRequirement: string;
    }
  | {
      supported: false;
      engine: 'none';
      reason: ArUnsupportedReason;
      userMessage: string;
      technicalHint: string;
    };

export interface ArDeviceProbe {
  os: string;
  osVersion: string | number | null | undefined;
  isDevice: boolean | null | undefined;
  hasViroNativeModule: boolean;
}

export const MIN_IOS_AR_VERSION = 15;
export const MIN_ANDROID_AR_API = 26;

function parseMajorVersion(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+)/);
    if (match?.[1]) return Number(match[1]);
  }
  return 0;
}

/**
 * Kiểm tra khả năng chạy AR (`@reactvision/react-viro` + ARKit/ARCore) — MOB-E9-01.
 * Tách hàm thuần nhận `probe` để unit test chính xác mọi biến thể iOS, Android, Simulator, Expo Go.
 */
export function evaluateArCapability(probe: ArDeviceProbe): ArCapabilityResult {
  if (probe.os !== 'ios' && probe.os !== 'android') {
    return {
      supported: false,
      engine: 'none',
      reason: 'unsupported_platform',
      userMessage: 'Chế độ AR chỉ khả dụng trên điện thoại iOS (ARKit) và Android (ARCore).',
      technicalHint: `Platform hiện tại "${probe.os}" không hỗ trợ ViroReact AR.`,
    };
  }

  if (probe.isDevice === false) {
    return {
      supported: false,
      engine: 'none',
      reason: 'emulator_not_supported',
      userMessage: 'Chế độ AR cần camera thực trên thiết bị thật (không chạy trên máy ảo/simulator).',
      technicalHint: 'Device.isDevice === false; hãy cài EAS Development Build trên máy thật.',
    };
  }

  const version = parseMajorVersion(probe.osVersion);
  if (probe.os === 'ios' && version > 0 && version < MIN_IOS_AR_VERSION) {
    return {
      supported: false,
      engine: 'none',
      reason: 'os_too_old',
      userMessage: `Thiết bị cần iOS ${MIN_IOS_AR_VERSION} trở lên để sử dụng ARKit.`,
      technicalHint: `Phát hiện iOS ${version} < ${MIN_IOS_AR_VERSION}.`,
    };
  }

  if (probe.os === 'android' && version > 0 && version < MIN_ANDROID_AR_API) {
    return {
      supported: false,
      engine: 'none',
      reason: 'os_too_old',
      userMessage: 'Thiết bị cần Android 8.0 (API 26) trở lên có hỗ trợ Google Play Services for AR.',
      technicalHint: `Phát hiện Android API ${version} < ${MIN_ANDROID_AR_API}.`,
    };
  }

  if (!probe.hasViroNativeModule) {
    return {
      supported: false,
      engine: 'none',
      reason: 'native_module_missing',
      userMessage:
        'Bản chạy hiện tại chưa tích hợp module AR native. Vui lòng mở bằng EAS Development Build.',
      technicalHint:
        'Thiếu native module Viro (Expo Go không hỗ trợ native ARKit/ARCore; cần prebuild / EAS dev build).',
    };
  }

  return probe.os === 'ios'
    ? {
        supported: true,
        engine: 'ARKit',
        platform: 'ios',
        minOsRequirement: `iOS ${MIN_IOS_AR_VERSION}+`,
      }
    : {
        supported: true,
        engine: 'ARCore',
        platform: 'android',
        minOsRequirement: `Android 8.0+ (API ${MIN_ANDROID_AR_API}+)`,
      };
}

/** Kiểm tra nhanh xem native Viro module có sẵn trong runtime hiện tại hay không. */
export function hasViroNativeRuntime(): boolean {
  try {
    const config = UIManager.getViewManagerConfig?.('VRTARSceneNavigator');
    if (config) return true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viro = require('@reactvision/react-viro') as { isViroJSIAvailable?: () => boolean };
    return typeof viro.isViroJSIAvailable === 'function' ? viro.isViroJSIAvailable() : false;
  } catch {
    return false;
  }
}

/** Đọc trạng thái thực tế của thiết bị đang chạy để quyết định mở AR hoặc hiện fallback 3D/2D. */
export function detectDeviceArCapability(): ArCapabilityResult {
  return evaluateArCapability({
    os: Platform.OS,
    osVersion: Platform.Version,
    isDevice: Device.isDevice,
    hasViroNativeModule: hasViroNativeRuntime(),
  });
}
