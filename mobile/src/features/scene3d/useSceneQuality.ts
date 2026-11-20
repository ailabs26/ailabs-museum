import { useCallback, useMemo, useRef, useState } from 'react';
import type { FpsSnapshot } from './fpsMeter';
import {
  AdaptiveQualityController,
  getQualityProfile,
  readDeviceCapabilityHints,
  resolveInitialQualityTier,
  type QualityMode,
  type QualityProfile,
  type QualityTier,
} from './performanceTier';

export interface SceneQualityState {
  mode: QualityMode;
  profile: QualityProfile;
  wasAutoDowngraded: boolean;
  setMode: (mode: QualityMode) => void;
  cycleMode: () => void;
  reportFpsSample: (snapshot: FpsSnapshot) => void;
}

const CYCLE_ORDER: readonly QualityMode[] = ['auto', 'low', 'balanced', 'high'];

/**
 * Hook quản lý phân tầng chất lượng 3D thích ứng theo thiết bị và FPS thực tế (MOB-E6-08).
 */
export function useSceneQuality(reducedMotion = false): SceneQualityState {
  const initialTier = useMemo<QualityTier>(
    () => resolveInitialQualityTier(readDeviceCapabilityHints(reducedMotion)),
    [reducedMotion],
  );

  const controllerRef = useRef<AdaptiveQualityController>(
    new AdaptiveQualityController({ initialTier }),
  );
  const [mode, setModeState] = useState<QualityMode>('auto');
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const [wasAutoDowngraded, setWasAutoDowngraded] = useState(false);

  const setMode = useCallback((nextMode: QualityMode) => {
    setModeState(nextMode);
    const result = controllerRef.current.setMode(nextMode);
    setTier(result.tier);
    if (nextMode !== 'auto') setWasAutoDowngraded(false);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((prev) => {
      const idx = CYCLE_ORDER.indexOf(prev);
      const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length] ?? 'auto';
      const result = controllerRef.current.setMode(next);
      setTier(result.tier);
      if (next !== 'auto') setWasAutoDowngraded(false);
      return next;
    });
  }, []);

  const reportFpsSample = useCallback((snapshot: FpsSnapshot) => {
    const result = controllerRef.current.evaluateSample(snapshot);
    if (result.changed) {
      setTier(result.tier);
      if (result.reason === 'fps_downgrade') setWasAutoDowngraded(true);
    }
  }, []);

  const profile = useMemo(() => getQualityProfile(tier), [tier]);

  return {
    mode,
    profile,
    wasAutoDowngraded,
    setMode,
    cycleMode,
    reportFpsSample,
  };
}
