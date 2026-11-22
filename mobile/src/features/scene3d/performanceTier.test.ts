import {
  AdaptiveQualityController,
  QUALITY_PROFILES,
  getQualityProfile,
  readDeviceCapabilityHints,
  resolveInitialQualityTier,
} from './performanceTier';
import type { FpsSnapshot } from './fpsMeter';

jest.mock('expo-device', () => ({
  totalMemory: 3 * 1024 * 1024 * 1024,
  deviceYearClass: 2019,
  isDevice: true,
}));

const GB = 1024 * 1024 * 1024;

function makeFps(fps: number, p95: number, sampleCount = 40): FpsSnapshot {
  return {
    fps,
    frameTimeMs: 1000 / Math.max(1, fps),
    p95FrameTimeMs: p95,
    droppedFrames16ms: fps < 55 ? sampleCount : 0,
    droppedFrames33ms: fps < 30 ? sampleCount : 0,
    sampleCount,
    meets60FpsTarget: fps >= 55 && p95 <= 20,
  };
}

describe('performanceTier — phân tầng chất lượng 3D theo thiết bị (MOB-E6-08)', () => {
  it('hạ xuống tầng low trên máy RAM yếu (≤4GB), đời cũ (≤2019), màn nhỏ hoặc emulator', () => {
    expect(resolveInitialQualityTier({ totalMemoryBytes: 3 * GB, deviceYearClass: 2022 })).toBe('low');
    expect(resolveInitialQualityTier({ totalMemoryBytes: 6 * GB, deviceYearClass: 2018 })).toBe('low');
    expect(resolveInitialQualityTier({ screenWidth: 360 })).toBe('low');
    expect(resolveInitialQualityTier({ totalMemoryBytes: 12 * GB, deviceYearClass: 2024, isEmulator: true })).toBe('low');

    const low = getQualityProfile('low');
    expect(low.dprCap).toBe(1);
    expect(low.enableShadows).toBe(false);
    expect(low.antialias).toBe(false);
    expect(low.maxConcurrentGlbLoads).toBe(1);
    expect(low.geometrySegments).toBeLessThan(QUALITY_PROFILES.high.geometrySegments);
  });

  it('chọn tầng high trên flagship hiện đại (≥8GB RAM, ≥2023) và balanced trên máy tầm trung / thiếu thông số', () => {
    expect(
      resolveInitialQualityTier({
        totalMemoryBytes: 8 * GB,
        deviceYearClass: 2024,
        screenWidth: 430,
        isEmulator: false,
      }),
    ).toBe('high');

    expect(
      resolveInitialQualityTier({
        totalMemoryBytes: 6 * GB,
        deviceYearClass: 2021,
        screenWidth: 390,
        isEmulator: false,
      }),
    ).toBe('balanced');

    expect(resolveInitialQualityTier({})).toBe('balanced');
  });

  it('đọc thông số thiết bị từ expo-device an toàn', () => {
    const hints = readDeviceCapabilityHints(false);
    expect(hints.totalMemoryBytes).toBe(3 * GB);
    expect(hints.deviceYearClass).toBe(2019);
    expect(resolveInitialQualityTier(hints)).toBe('low');
  });

  it('tự động hạ tầng high → balanced → low khi rớt FPS liên tiếp, chống dao động và tôn trọng khóa thủ công', () => {
    const ctrl = new AdaptiveQualityController({
      initialTier: 'high',
      downgradeStreak: 3,
      upgradeStreak: 4,
      cooldownMs: 10_000,
    });

    // 1 khung chậm đơn lẻ không gây giật tầng.
    expect(ctrl.evaluateSample(makeFps(20, 50), 1000).changed).toBe(false);
    expect(ctrl.evaluateSample(makeFps(58, 17), 2000).changed).toBe(false);
    expect(ctrl.getTier()).toBe('high');

    // 3 cửa sổ liên tiếp < 26 FPS -> hạ từ high xuống balanced.
    expect(ctrl.evaluateSample(makeFps(22, 48), 3000).changed).toBe(false);
    expect(ctrl.evaluateSample(makeFps(21, 50), 4000).changed).toBe(false);
    const firstDrop = ctrl.evaluateSample(makeFps(19, 55), 5000);
    expect(firstDrop).toEqual({ tier: 'balanced', changed: true, reason: 'fps_downgrade' });

    // Tiếp tục chậm -> hạ xuống low và ở yên low (không lỗi biên).
    ctrl.evaluateSample(makeFps(20, 52), 6000);
    ctrl.evaluateSample(makeFps(20, 52), 7000);
    expect(ctrl.evaluateSample(makeFps(20, 52), 8000)).toEqual({
      tier: 'low',
      changed: true,
      reason: 'fps_downgrade',
    });
    expect(ctrl.evaluateSample(makeFps(18, 60), 9000).changed).toBe(false);

    // Chưa hết cooldown 10s -> chưa nâng tầng dù đạt 60 FPS.
    for (let i = 0; i < 4; i++) {
      expect(ctrl.evaluateSample(makeFps(60, 16.5), 10_000 + i * 500).changed).toBe(false);
    }
    // Sau khi qua cooldown (8000 + 10000 = 18000) -> nâng lại lên balanced.
    expect(ctrl.evaluateSample(makeFps(60, 16.5), 20_000)).toEqual({
      tier: 'balanced',
      changed: true,
      reason: 'fps_upgrade',
    });

    // Khóa thủ công 'low' -> không bao giờ tự đổi tầng.
    expect(ctrl.setMode('low')).toEqual({ tier: 'low', changed: true, reason: 'manual' });
    for (let i = 0; i < 10; i++) {
      expect(ctrl.evaluateSample(makeFps(60, 16), 40_000 + i * 1000).changed).toBe(false);
    }
    expect(ctrl.getTier()).toBe('low');
  });
});
