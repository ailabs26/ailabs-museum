import { evaluateArCapability } from './arCapability';
import { mapViroTrackingState } from './arBridge';

describe('arCapability & arBridge (MOB-E9-01)', () => {
  it('nhận diện đúng ARKit trên iPhone iOS 15+ và ARCore trên Android API 26+ có Viro native', () => {
    expect(
      evaluateArCapability({
        os: 'ios',
        osVersion: '17.4',
        isDevice: true,
        hasViroNativeModule: true,
      }),
    ).toEqual({
      supported: true,
      engine: 'ARKit',
      platform: 'ios',
      minOsRequirement: 'iOS 15+',
    });

    expect(
      evaluateArCapability({
        os: 'android',
        osVersion: 34,
        isDevice: true,
        hasViroNativeModule: true,
      }),
    ).toEqual({
      supported: true,
      engine: 'ARCore',
      platform: 'android',
      minOsRequirement: 'Android 8.0+ (API 26+)',
    });
  });

  it('từ chối rõ ràng web, simulator/emulator, OS cũ và Expo Go thiếu Viro native', () => {
    expect(
      evaluateArCapability({
        os: 'web',
        osVersion: '1',
        isDevice: true,
        hasViroNativeModule: false,
      }),
    ).toMatchObject({ supported: false, reason: 'unsupported_platform' });

    expect(
      evaluateArCapability({
        os: 'ios',
        osVersion: '17.0',
        isDevice: false,
        hasViroNativeModule: true,
      }),
    ).toMatchObject({ supported: false, reason: 'emulator_not_supported' });

    expect(
      evaluateArCapability({
        os: 'ios',
        osVersion: '14.8',
        isDevice: true,
        hasViroNativeModule: true,
      }),
    ).toMatchObject({ supported: false, reason: 'os_too_old' });

    expect(
      evaluateArCapability({
        os: 'android',
        osVersion: 24,
        isDevice: true,
        hasViroNativeModule: true,
      }),
    ).toMatchObject({ supported: false, reason: 'os_too_old' });

    expect(
      evaluateArCapability({
        os: 'android',
        osVersion: 33,
        isDevice: true,
        hasViroNativeModule: false,
      }),
    ).toMatchObject({ supported: false, reason: 'native_module_missing' });
  });

  it('ánh xạ đầy đủ các trạng thái ViroTrackingStateConstants sang thông báo tiếng Việt', () => {
    expect(mapViroTrackingState(3).quality).toBe('normal');
    expect(mapViroTrackingState(2, 2)).toMatchObject({
      quality: 'limited',
      label: expect.stringMatching(/Di chuyển máy chậm lại/),
    });
    expect(mapViroTrackingState(2, 3)).toMatchObject({
      quality: 'limited',
      label: expect.stringMatching(/thiếu ánh sáng/),
    });
    expect(mapViroTrackingState(1).quality).toBe('unavailable');
    expect(mapViroTrackingState(0).quality).toBe('initializing');
  });
});
