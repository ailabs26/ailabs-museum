import * as Device from 'expo-device';
import { Dimensions, PixelRatio } from 'react-native';
import type { FpsSnapshot } from './fpsMeter';

export type QualityTier = 'low' | 'balanced' | 'high';
export type QualityMode = 'auto' | QualityTier;

export interface QualityProfile {
  tier: QualityTier;
  label: string;
  dprCap: number;
  enableShadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  maxConcurrentGlbLoads: number;
  maxCacheBytes: number;
  geometrySegments: number;
  anisotropy: number;
  enableSecondaryLights: boolean;
}

export interface DeviceCapabilityHints {
  totalMemoryBytes?: number | null;
  deviceYearClass?: number | null;
  pixelRatio?: number;
  screenWidth?: number;
  isEmulator?: boolean;
  reducedMotion?: boolean;
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    label: 'Thấp (Tiết kiệm)',
    dprCap: 1,
    enableShadows: false,
    shadowMapSize: 0,
    antialias: false,
    maxConcurrentGlbLoads: 1,
    maxCacheBytes: 64 * MB,
    geometrySegments: 16,
    anisotropy: 2,
    enableSecondaryLights: false,
  },
  balanced: {
    tier: 'balanced',
    label: 'Cân bằng',
    dprCap: 1.5,
    enableShadows: true,
    shadowMapSize: 1024,
    antialias: true,
    maxConcurrentGlbLoads: 2,
    maxCacheBytes: 150 * MB,
    geometrySegments: 24,
    anisotropy: 4,
    enableSecondaryLights: true,
  },
  high: {
    tier: 'high',
    label: 'Cao',
    dprCap: 2,
    enableShadows: true,
    shadowMapSize: 2048,
    antialias: true,
    maxConcurrentGlbLoads: 3,
    maxCacheBytes: 256 * MB,
    geometrySegments: 32,
    anisotropy: 8,
    enableSecondaryLights: true,
  },
};

const TIER_ORDER: readonly QualityTier[] = ['low', 'balanced', 'high'];

/**
 * Phân tầng chất lượng 3D ban đầu theo năng lực phần cứng thực tế (MOB-E6-08).
 * Máy RAM ≤ 4 GB, đời cũ (≤ 2019), màn rất nhỏ hoặc emulator tự hạ xuống `low` để giữ mượt.
 */
export function resolveInitialQualityTier(hints: DeviceCapabilityHints): QualityTier {
  const mem = hints.totalMemoryBytes;
  const year = hints.deviceYearClass;
  const width = hints.screenWidth;

  const lowMemory = typeof mem === 'number' && Number.isFinite(mem) && mem > 0 && mem <= 4 * GB;
  const oldDevice = typeof year === 'number' && Number.isFinite(year) && year > 0 && year <= 2019;
  const narrowScreen = typeof width === 'number' && Number.isFinite(width) && width > 0 && width <= 360;

  if (lowMemory || oldDevice || narrowScreen || hints.isEmulator) {
    return 'low';
  }

  const highMemory = typeof mem === 'number' && Number.isFinite(mem) && mem >= 8 * GB;
  const modernDevice = typeof year === 'number' && Number.isFinite(year) && year >= 2023;
  if (highMemory && modernDevice && !hints.reducedMotion) {
    return 'high';
  }

  return 'balanced';
}

export function getQualityProfile(tier: QualityTier): QualityProfile {
  return QUALITY_PROFILES[tier];
}

/** Đọc an toàn thông số phần cứng từ `expo-device`, `Dimensions` và `PixelRatio`. */
export function readDeviceCapabilityHints(reducedMotion = false): DeviceCapabilityHints {
  const window = Dimensions.get('window');
  return {
    totalMemoryBytes: typeof Device.totalMemory === 'number' ? Device.totalMemory : null,
    deviceYearClass: typeof Device.deviceYearClass === 'number' ? Device.deviceYearClass : null,
    pixelRatio: PixelRatio.get(),
    screenWidth: window.width,
    isEmulator: Device.isDevice === false,
    reducedMotion,
  };
}

export interface AdaptiveQualityOptions {
  initialTier: QualityTier;
  /** Số cửa sổ FPS thấp liên tiếp trước khi hạ tầng (mặc định 3). */
  downgradeStreak?: number;
  /** Số cửa sổ FPS cao liên tiếp trước khi cân nhắc nâng tầng (mặc định 6). */
  upgradeStreak?: number;
  /** Thời gian chờ tối thiểu giữa hai lần đổi tầng để tránh dao động (mặc định 15s). */
  cooldownMs?: number;
}

export interface AdaptiveTransitionResult {
  tier: QualityTier;
  changed: boolean;
  reason: 'initial' | 'fps_downgrade' | 'fps_upgrade' | 'manual' | 'unchanged';
}

/**
 * Bộ điều chỉnh chất lượng động có trễ chống dao động (hysteresis) khi máy nóng hoặc rớt FPS (MOB-E6-08).
 */
export class AdaptiveQualityController {
  private currentTier: QualityTier;
  private manualOverride: QualityTier | null = null;
  private slowStreak = 0;
  private smoothStreak = 0;
  private lastChangeAtMs: number | null = null;
  private readonly downgradeStreak: number;
  private readonly upgradeStreak: number;
  private readonly cooldownMs: number;

  constructor(options: AdaptiveQualityOptions) {
    this.currentTier = options.initialTier;
    this.downgradeStreak = Math.max(1, options.downgradeStreak ?? 3);
    this.upgradeStreak = Math.max(2, options.upgradeStreak ?? 6);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 15_000);
  }

  getTier(): QualityTier {
    return this.manualOverride ?? this.currentTier;
  }

  setMode(mode: QualityMode): AdaptiveTransitionResult {
    this.slowStreak = 0;
    this.smoothStreak = 0;
    if (mode === 'auto') {
      this.manualOverride = null;
      return { tier: this.currentTier, changed: true, reason: 'manual' };
    }
    this.manualOverride = mode;
    return { tier: mode, changed: true, reason: 'manual' };
  }

  /** Đánh giá mẫu FPS mới; tự hạ chất lượng khi thiết bị yếu/nóng rớt dưới 26 FPS hoặc p95 > 42 ms. */
  evaluateSample(snapshot: FpsSnapshot, nowMs = Date.now()): AdaptiveTransitionResult {
    if (this.manualOverride !== null || snapshot.sampleCount < 20) {
      return { tier: this.getTier(), changed: false, reason: 'unchanged' };
    }

    const isStruggling = snapshot.fps < 26 || snapshot.p95FrameTimeMs > 42;
    const isVerySmooth = snapshot.fps >= 55 && snapshot.p95FrameTimeMs <= 19;

    if (isStruggling) {
      this.slowStreak += 1;
      this.smoothStreak = 0;
      const idx = TIER_ORDER.indexOf(this.currentTier);
      if (this.slowStreak >= this.downgradeStreak && idx > 0) {
        const nextTier = TIER_ORDER[idx - 1]!;
        this.currentTier = nextTier;
        this.slowStreak = 0;
        this.lastChangeAtMs = nowMs;
        return { tier: nextTier, changed: true, reason: 'fps_downgrade' };
      }
      return { tier: this.currentTier, changed: false, reason: 'unchanged' };
    }

    this.slowStreak = 0;
    if (isVerySmooth) {
      this.smoothStreak += 1;
      const idx = TIER_ORDER.indexOf(this.currentTier);
      const cooledDown =
        this.lastChangeAtMs === null || nowMs - this.lastChangeAtMs >= this.cooldownMs;
      if (this.smoothStreak >= this.upgradeStreak && idx < TIER_ORDER.length - 1 && cooledDown) {
        const nextTier = TIER_ORDER[idx + 1]!;
        this.currentTier = nextTier;
        this.smoothStreak = 0;
        this.lastChangeAtMs = nowMs;
        return { tier: nextTier, changed: true, reason: 'fps_upgrade' };
      }
    } else {
      this.smoothStreak = 0;
    }

    return { tier: this.currentTier, changed: false, reason: 'unchanged' };
  }
}
