import type { ModelNormalization } from '@/features/scene3d/glbValidation';
import type { MuseumDisplay } from '@/features/scene3d/museumTypes';
import { clampArScale, computeArModelTransform, type Vec3 } from './arPlacementMath';

export interface ArHotspotMarker {
  id: string;
  exhibitId: string;
  label: string;
  body: string;
  /** Tọa độ cục bộ trong node AR đã đặt (mét, Y hướng lên từ mặt phẳng AR y = 0). */
  position: Vec3;
  orderIndex: number;
  isDefault: boolean;
}

export interface ArHotspotStoryState {
  selectedId: string | null;
}

export type ArHotspotStoryAction =
  | { type: 'SELECT'; hotspotId: string }
  | { type: 'TOGGLE'; hotspotId: string }
  | { type: 'NEXT'; hotspots: readonly ArHotspotMarker[] }
  | { type: 'PREV'; hotspots: readonly ArHotspotMarker[] }
  | { type: 'CLOSE' }
  | { type: 'RECONCILE'; hotspots: readonly ArHotspotMarker[] };

const MAX_AR_HORIZ_EXTENT = 3;
const MIN_AR_Y = -0.25;
const MAX_AR_Y = 3.2;

function isSafeArPoint(point: readonly number[] | undefined): point is Vec3 {
  if (!point || point.length !== 3) return false;
  const [x, y, z] = point;
  return (
    x !== undefined &&
    y !== undefined &&
    z !== undefined &&
    [x, y, z].every(Number.isFinite) &&
    Math.abs(x) <= MAX_AR_HORIZ_EXTENT &&
    Math.abs(z) <= MAX_AR_HORIZ_EXTENT &&
    y >= MIN_AR_Y &&
    y <= MAX_AR_Y
  );
}

/**
 * Chuyển đổi tọa độ hotspot của hiện vật (đồng bộ hợp đồng `front-end/src/helpers/artifactHotspots.ts`)
 * sang không gian cục bộ AR đặt trên mặt phẳng y = 0 (MOB-E9-03).
 * Luôn tạo hotspot mặc định khi hiện vật chưa khai báo hotspot và thay tọa độ lỗi bằng vị trí dự phòng an toàn.
 */
export function resolveArHotspots(
  exhibit: MuseumDisplay,
  normalization?: ModelNormalization,
  targetArHeightMeters = 0.55,
): ArHotspotMarker[] {
  const authored = exhibit.hotspots && exhibit.hotspots.length > 0 ? exhibit.hotspots : null;
  const sourceList = authored ?? [
    {
      id: `${exhibit.id}:default`,
      label: exhibit.title,
      body: exhibit.description,
      position: undefined,
    },
  ];

  const arFit = computeArModelTransform(1, normalization, targetArHeightMeters);
  const fallbackY = Math.min(MAX_AR_Y - 0.1, targetArHeightMeters + 0.14);

  return sourceList.map((item, index) => {
    let resolvedPosition: Vec3 | null = null;

    if (item.position && item.position.every(Number.isFinite)) {
      if (exhibit.model && normalization) {
        const s = arFit.scale[0];
        const candidate: Vec3 = [
          (item.position[0] + normalization.offset[0]) * s,
          (item.position[1] + normalization.offset[1]) * s,
          (item.position[2] + normalization.offset[2]) * s,
        ];
        if (isSafeArPoint(candidate)) resolvedPosition = candidate;
      } else if (!exhibit.model && isSafeArPoint(item.position)) {
        resolvedPosition = [item.position[0], item.position[1], item.position[2]];
      }
    }

    if (!resolvedPosition) {
      const spread = Math.min(0.18, 0.5 / Math.max(1, sourceList.length));
      const offsetX = (index - (sourceList.length - 1) / 2) * spread;
      resolvedPosition = [Math.round(offsetX * 1000) / 1000, fallbackY, 0];
    }

    return {
      id: item.id,
      exhibitId: exhibit.id,
      label: item.label.trim() || exhibit.title,
      body: item.body,
      position: resolvedPosition,
      orderIndex: index,
      isDefault: authored === null,
    };
  });
}

/**
 * Bù kích thước marker hotspot theo nghịch đảo căn bậc hai của `arScale`
 * để điểm chạm luôn dễ bấm dù người dùng thu nhỏ 25% hay phóng to 250%.
 */
export function computeArMarkerRadius(arScale: number, isSelected: boolean): number {
  const safeScale = clampArScale(arScale);
  const baseRadius = isSelected ? 0.042 : 0.032;
  const compensated = baseRadius / Math.sqrt(safeScale);
  return Math.round(Math.max(0.02, Math.min(0.08, compensated)) * 1000) / 1000;
}

export interface ResolvedArHotspotStory {
  hotspot: ArHotspotMarker;
  index: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function resolveArHotspotStory(
  hotspots: readonly ArHotspotMarker[],
  selectedId: string | null,
): ResolvedArHotspotStory | null {
  if (!selectedId || hotspots.length === 0) return null;
  const index = hotspots.findIndex((item) => item.id === selectedId);
  if (index === -1) return null;
  const hotspot = hotspots[index];
  if (!hotspot) return null;
  return {
    hotspot,
    index,
    total: hotspots.length,
    hasPrev: index > 0,
    hasNext: index < hotspots.length - 1,
  };
}

export function arHotspotStoryReducer(
  state: ArHotspotStoryState,
  action: ArHotspotStoryAction,
): ArHotspotStoryState {
  switch (action.type) {
    case 'SELECT':
      return { selectedId: action.hotspotId };

    case 'TOGGLE':
      return {
        selectedId: state.selectedId === action.hotspotId ? null : action.hotspotId,
      };

    case 'NEXT': {
      if (action.hotspots.length === 0) return { selectedId: null };
      const currentIdx = action.hotspots.findIndex((h) => h.id === state.selectedId);
      const nextIdx =
        currentIdx === -1 ? 0 : Math.min(action.hotspots.length - 1, currentIdx + 1);
      return { selectedId: action.hotspots[nextIdx]?.id ?? null };
    }

    case 'PREV': {
      if (action.hotspots.length === 0) return { selectedId: null };
      const currentIdx = action.hotspots.findIndex((h) => h.id === state.selectedId);
      const prevIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
      return { selectedId: action.hotspots[prevIdx]?.id ?? null };
    }

    case 'CLOSE':
      return { selectedId: null };

    case 'RECONCILE': {
      if (!state.selectedId) return state;
      const stillExists = action.hotspots.some((h) => h.id === state.selectedId);
      return stillExists ? state : { selectedId: null };
    }

    default:
      return state;
  }
}
