import type { MediaRights, PublicModel } from './glbSchema';

/**
 * Hằng số hình học phòng trưng bày 3D đồng bộ 1:1 với `front-end/src/interfaces/museumScene.ts`
 * (MOB-E6-04). Đơn vị: mét, trục Y hướng lên, mặt sàn y = 0, tâm phòng tại (0, 0, 0).
 */
export const MUSEUM_ROOM_SIZE = { width: 14, depth: 16, height: 5 } as const;

/** Kích thước chân bục vật lý dùng chung cho render 3D và bộ va chạm điều hướng. */
export const EXHIBIT_PLINTH_SIZE = {
  centerpieceRadius: 1.22,
  roundRadius: 0.76,
  squareWidth: 1.15,
} as const;

/** Kích thước nhãn hiện vật dùng khi kiểm tra hiện vật có vượt ra ngoài vỏ phòng hay không. */
export const EXHIBIT_LABEL_SIZE = {
  width: 1.25,
  height: 0.3125,
  depth: 0.75,
  centerpieceDepth: 1.24,
} as const;

/** Cao độ mặt bục trưng bày (m) — mô hình GLB, hotspot và camera focus dùng chung mốc này. */
export const ARTIFACT_BASE_Y = 1.14;

export type ExhibitPlaceholderShape =
  | 'sphere'
  | 'torus'
  | 'cone'
  | 'cube'
  | 'icosahedron'
  | 'cylinder';

export interface MuseumHotspotData {
  id: string;
  label: string;
  body: string;
  /** Tọa độ cục bộ của GLB nguồn hoặc tọa độ cục bộ display (m, Y hướng lên). */
  position?: [number, number, number];
}

export interface MuseumDisplay {
  id: string;
  revisionId?: string;
  roomId?: string;
  title: string;
  description: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  shape: ExhibitPlaceholderShape;
  color: string;
  model?: PublicModel | null;
  hotspots?: readonly MuseumHotspotData[];
  credits?: readonly MediaRights[];
  isOutsideRoom?: boolean;
}

export interface PublicRoomExhibitPayload {
  id: string;
  revisionId?: string;
  roomId: string;
  displayOrder: number;
  name: string;
  description: string;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  placeholderShape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus';
  placeholderColor: string;
  model?: PublicModel | null;
  i18n?: Partial<
    Record<'vi' | 'en' | 'fr' | 'zh' | 'ko' | 'ja', { name: string | null; description: string | null }>
  >;
  hotspots?: readonly {
    id: string;
    label: string;
    body: string;
    positionX: number;
    positionY: number;
    positionZ: number;
    displayOrder: number;
  }[];
}

export interface PublicRoomPayload {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  exhibits: readonly PublicRoomExhibitPayload[];
}
