import type { ModelNormalization } from '@/features/scene3d/glbValidation';
import type { ArTrackingQuality } from './arBridge';

export type ArPlacementStatus = 'scanning' | 'plane_detected' | 'placed';
export type Vec3 = [number, number, number];

export interface ArPlacementState {
  status: ArPlacementStatus;
  trackingQuality: ArTrackingQuality;
  trackingMessage: string;
  planeCount: number;
  anchorPosition: Vec3 | null;
  scale: number;
  minScale: number;
  maxScale: number;
  rotationYDeg: number;
  /** Lưu mốc scale lúc bắt đầu pinch (state === 1) để tránh nhân dồn bùng nổ kích thước. */
  pinchBaseScale: number | null;
  /** Lưu mốc góc xoay lúc bắt đầu rotate (state === 1) để tránh cộng dồn giật khung. */
  rotateBaseDeg: number | null;
}

export type ArPlacementAction =
  | { type: 'TRACKING_UPDATED'; quality: ArTrackingQuality; message: string }
  | { type: 'PLANE_DETECTED' }
  | { type: 'PLACE_AT'; position: Vec3 }
  | { type: 'REPOSITION' }
  | { type: 'PINCH_GESTURE'; gestureState: number; scaleFactor: number }
  | { type: 'ROTATE_GESTURE'; gestureState: number; rotationFactorDeg: number }
  | { type: 'STEP_SCALE'; delta: number }
  | { type: 'STEP_ROTATE'; deltaDeg: number }
  | { type: 'RESET_TRANSFORM' };

export const AR_DEFAULT_SCALE = 1;
export const AR_MIN_SCALE = 0.25;
export const AR_MAX_SCALE = 2.5;

export function createInitialArPlacementState(options: {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
} = {}): ArPlacementState {
  const minScale =
    options.minScale !== undefined && Number.isFinite(options.minScale) && options.minScale > 0
      ? options.minScale
      : AR_MIN_SCALE;
  const maxScale =
    options.maxScale !== undefined && Number.isFinite(options.maxScale) && options.maxScale > minScale
      ? options.maxScale
      : AR_MAX_SCALE;
  const scale = clampArScale(options.initialScale ?? AR_DEFAULT_SCALE, minScale, maxScale);

  return {
    status: 'scanning',
    trackingQuality: 'initializing',
    trackingMessage: 'Di chuyển chậm điện thoại để quét mặt phẳng ngang...',
    planeCount: 0,
    anchorPosition: null,
    scale,
    minScale,
    maxScale,
    rotationYDeg: 0,
    pinchBaseScale: null,
    rotateBaseDeg: null,
  };
}

/** Kẹp tỷ lệ phóng to/thu nhỏ trong phạm vi ổn định và loại bỏ giá trị NaN/Infinity/âm. */
export function clampArScale(
  value: number,
  minScale: number = AR_MIN_SCALE,
  maxScale: number = AR_MAX_SCALE,
): number {
  if (!Number.isFinite(value) || value <= 0) return AR_DEFAULT_SCALE;
  return Math.round(Math.max(minScale, Math.min(maxScale, value)) * 1000) / 1000;
}

/** Chuẩn hóa góc xoay quanh trục Y về đoạn [0, 360) độ. */
export function normalizeAngleDeg(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  const wrapped = ((angleDeg % 360) + 360) % 360;
  return Math.round(wrapped * 10) / 10;
}

export function isValidVec3(point: readonly number[]): point is Vec3 {
  return point.length === 3 && point.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Tính vị trí và tỷ lệ thực để đặt GLB chuẩn hóa từ `MOB-E6-02` chạm khít mặt phẳng AR (đáy y = 0).
 * Thu nhỏ chuẩn trưng bày phòng (1.8 m) xuống kích thước bàn/phòng AR (~0.45 m mặc định khi scale = 1).
 */
export function computeArModelTransform(
  arScale: number,
  normalization?: ModelNormalization,
  targetArHeightMeters = 0.55,
): { scale: Vec3; positionOffset: Vec3 } {
  const safeScale = clampArScale(arScale);
  if (!normalization) {
    return {
      scale: [safeScale, safeScale, safeScale],
      positionOffset: [0, 0, 0],
    };
  }
  const maxDim = Math.max(normalization.size[0], normalization.size[1], normalization.size[2], 0.1);
  const arFitFactor = targetArHeightMeters / maxDim;
  const finalScale = normalization.scale * arFitFactor * safeScale;
  return {
    scale: [finalScale, finalScale, finalScale],
    positionOffset: [
      normalization.offset[0] * finalScale,
      normalization.offset[1] * finalScale,
      normalization.offset[2] * finalScale,
    ],
  };
}

/**
 * Máy trạng thái thuần TypeScript cho luồng đặt hiện vật trên mặt phẳng AR + cử chỉ xoay/zoom
 * (MOB-E9-02). Xử lý chuẩn 3 pha cử chỉ Viro (1=START, 2=MOVE, 3=END) không nhân dồn sai số.
 */
export function arPlacementReducer(
  state: ArPlacementState,
  action: ArPlacementAction,
): ArPlacementState {
  switch (action.type) {
    case 'TRACKING_UPDATED':
      return {
        ...state,
        trackingQuality: action.quality,
        trackingMessage: action.message,
      };

    case 'PLANE_DETECTED':
      return {
        ...state,
        planeCount: state.planeCount + 1,
        status: state.status === 'scanning' ? 'plane_detected' : state.status,
      };

    case 'PLACE_AT': {
      if (!isValidVec3(action.position)) return state;
      return {
        ...state,
        status: 'placed',
        anchorPosition: [action.position[0], action.position[1], action.position[2]],
        pinchBaseScale: null,
        rotateBaseDeg: null,
      };
    }

    case 'REPOSITION':
      return {
        ...state,
        status: state.planeCount > 0 ? 'plane_detected' : 'scanning',
        anchorPosition: null,
        pinchBaseScale: null,
        rotateBaseDeg: null,
      };

    case 'PINCH_GESTURE': {
      if (state.status !== 'placed') return state;
      if (!Number.isFinite(action.scaleFactor) || action.scaleFactor <= 0) return state;
      if (action.gestureState === 1) {
        return { ...state, pinchBaseScale: state.scale };
      }
      const base = state.pinchBaseScale ?? state.scale;
      const nextScale = clampArScale(base * action.scaleFactor, state.minScale, state.maxScale);
      if (action.gestureState === 2) {
        return { ...state, scale: nextScale, pinchBaseScale: base };
      }
      if (action.gestureState === 3) {
        return { ...state, scale: nextScale, pinchBaseScale: null };
      }
      return state;
    }

    case 'ROTATE_GESTURE': {
      if (state.status !== 'placed') return state;
      if (!Number.isFinite(action.rotationFactorDeg)) return state;
      if (action.gestureState === 1) {
        return { ...state, rotateBaseDeg: state.rotationYDeg };
      }
      const base = state.rotateBaseDeg ?? state.rotationYDeg;
      const nextAngle = normalizeAngleDeg(base - action.rotationFactorDeg);
      if (action.gestureState === 2) {
        return { ...state, rotationYDeg: nextAngle, rotateBaseDeg: base };
      }
      if (action.gestureState === 3) {
        return { ...state, rotationYDeg: nextAngle, rotateBaseDeg: null };
      }
      return state;
    }

    case 'STEP_SCALE': {
      if (state.status !== 'placed' || !Number.isFinite(action.delta)) return state;
      return {
        ...state,
        scale: clampArScale(state.scale + action.delta, state.minScale, state.maxScale),
        pinchBaseScale: null,
      };
    }

    case 'STEP_ROTATE': {
      if (state.status !== 'placed' || !Number.isFinite(action.deltaDeg)) return state;
      return {
        ...state,
        rotationYDeg: normalizeAngleDeg(state.rotationYDeg + action.deltaDeg),
        rotateBaseDeg: null,
      };
    }

    case 'RESET_TRANSFORM':
      return {
        ...state,
        scale: clampArScale(AR_DEFAULT_SCALE, state.minScale, state.maxScale),
        rotationYDeg: 0,
        pinchBaseScale: null,
        rotateBaseDeg: null,
      };

    default:
      return state;
  }
}
