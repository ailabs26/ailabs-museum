import { EXHIBIT_PLINTH_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { ARTIFACT_BASE_Y } from './artifactHotspots';

/**
 * Vùng trống bên trong vỏ Rotunda (mét, gốc tại tâm phòng). Trang trí không có collider, nên mọi chi tiết phải nằm
 * ngoài vùng này; e2e `museum-gallery-slots.spec.ts` đo hình học thật của scene để chứng minh.
 * - Dưới `wallTrimTopY`: trang trí chỉ bám tường, mặt trong ở |x| ≥ `sideWallX`, |z| ≥ `endWallZ`.
 * - Từ `wallTrimTopY` tới `ceilingY`: phào trần nhô sâu hơn, tới |x| ≥ `upperSideWallX`, |z| ≥ `upperEndWallZ`.
 * - Từ `ceilingY` trở lên: vòng trần, giếng trời, nan gỗ.
 * Decal sát sàn (dày ≤ 1 cm: hoạ tiết, quầng sáng) không chiếm chỗ.
 */
export const ROTUNDA_CLEARANCE = {
  sideWallX: 6.88, endWallZ: 7.86, wallTrimTopY: 4.5,
  upperSideWallX: 6.7, upperEndWallZ: 7.7, ceilingY: 4.71,
  floorDecalTopY: 0.011,
} as const;

/** Khối vật lý của một hiện vật đặt ở tọa độ tự do: bục + mô hình/khối tạm (không tính nhãn, hotspot, decal). */
export function getDisplayPhysicalBounds(display: Pick<MuseumDisplay, 'position' | 'shape' | 'model'>) {
  const [x, y, z] = display.position;
  const isCenterpiece = !!display.model || display.shape === 'torus';
  const isRound = isCenterpiece || display.shape === 'sphere' || display.shape === 'cylinder';
  const radius = isCenterpiece ? EXHIBIT_PLINTH_SIZE.centerpieceRadius : isRound ? EXHIBIT_PLINTH_SIZE.roundRadius : EXHIBIT_PLINTH_SIZE.squareWidth / 2;
  // Mô hình chuẩn hóa ≤ 1,8 × 2,2 × 1,8 m trên mặt bục; khối tạm theo `ExhibitPlaceholder`.
  const top = display.model ? ARTIFACT_BASE_Y + 2.2 : display.shape === 'torus' ? 2.16 + 1 : 1.73 + 0.64;
  return { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius, minY: y, maxY: y + top };
}

/** Khối vật lý có nằm trọn trong vùng trống của vỏ Rotunda không. */
export function fitsRotundaClearance(bounds: ReturnType<typeof getDisplayPhysicalBounds>): boolean {
  const c = ROTUNDA_CLEARANCE;
  const [side, end] = bounds.maxY > c.wallTrimTopY ? [c.upperSideWallX, c.upperEndWallZ] : [c.sideWallX, c.endWallZ];
  return bounds.maxY <= c.ceilingY && Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) <= side
    && Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) <= end;
}
