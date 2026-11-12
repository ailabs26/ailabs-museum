import { EXHIBIT_PLINTH_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { getDisplayColliders, NAVIGATION, type NavigationCollider } from './museumNavigation';

export type GallerySlotId = 'S01' | 'S02' | 'S03' | 'S04' | 'S05';

export interface GallerySlotDefinition {
  id: GallerySlotId;
  /** Khóa i18n công khai; `label` là bản tiếng Việt dự phòng (và nhãn trong CMS). */
  labelKey: string;
  label: string;
  /** Mét, Y hướng lên; gốc tại tâm phòng, sàn y = 0. */
  position: readonly [number, 0, number];
  plinthKind: 'hero' | 'standard';
  /** Bán kính vật cản của bục — chưa cộng `NAVIGATION.bodyRadius`. */
  footprintRadius: number;
}

export interface ResolvedGallerySlot {
  slot: GallerySlotDefinition;
  exhibit: MuseumDisplay | null;
}

export type GalleryLegacyReason = 'unmatched-position' | 'too-many-exhibits' | 'duplicate-slot';
export type GalleryLayoutResolution =
  | { mode: 'slotted'; slots: readonly ResolvedGallerySlot[] }
  | { mode: 'legacy'; displays: readonly MuseumDisplay[]; reason: GalleryLegacyReason };

/**
 * Nguồn sự thật duy nhất của Gallery Template V1: scene, collider, minimap và CMS cùng đọc từ đây.
 * Không suy ra bục từ `displayOrder` — đó là thứ tự tour, không phải tọa độ.
 */
export const GALLERY_SLOTS: readonly GallerySlotDefinition[] = [
  { id: 'S01', labelKey: 'ui.slot.center', label: 'Bục 01 – Trung tâm', position: [0, 0, -2], plinthKind: 'hero', footprintRadius: EXHIBIT_PLINTH_SIZE.centerpieceRadius },
  { id: 'S02', labelKey: 'ui.slot.back-left', label: 'Bục 02 – Trái sau', position: [-4.3, 0, -4.2], plinthKind: 'standard', footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius },
  { id: 'S03', labelKey: 'ui.slot.back-right', label: 'Bục 03 – Phải sau', position: [4.3, 0, -4.2], plinthKind: 'standard', footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius },
  { id: 'S04', labelKey: 'ui.slot.front-left', label: 'Bục 04 – Trái trước', position: [-4.3, 0, 2.1], plinthKind: 'standard', footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius },
  { id: 'S05', labelKey: 'ui.slot.front-right', label: 'Bục 05 – Phải trước', position: [4.3, 0, 2.1], plinthKind: 'standard', footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius },
];

/** Sai số khi khớp tọa độ đã lưu với bục (mét). Không làm tròn rộng hơn để tránh nhận nhầm tọa độ tự do. */
export const GALLERY_SLOT_TOLERANCE = 0.05;

/** Bục ứng với một tọa độ XYZ, hoặc `null` nếu là tọa độ tự do (legacy). */
export function matchGallerySlot(position: readonly [number, number, number]): GallerySlotDefinition | null {
  const [x, y, z] = position;
  if (![x, y, z].every(Number.isFinite) || Math.abs(y) > GALLERY_SLOT_TOLERANCE) return null;
  return GALLERY_SLOTS.find(slot => Math.abs(x - slot.position[0]) <= GALLERY_SLOT_TOLERANCE
    && Math.abs(z - slot.position[2]) <= GALLERY_SLOT_TOLERANCE) ?? null;
}

/**
 * Phòng rỗng hoặc mọi hiện vật khớp duy nhất một bục → `slotted` (luôn đủ 5 bục).
 * Còn lại → `legacy`: giữ nguyên vị trí, kiến trúc và collider cũ; không ẩn, không cắt, không tự di dời.
 */
export function resolveGalleryLayout(displays: readonly MuseumDisplay[]): GalleryLayoutResolution {
  if (displays.length > GALLERY_SLOTS.length) return { mode: 'legacy', displays, reason: 'too-many-exhibits' };
  const occupants = new Map<GallerySlotId, MuseumDisplay>();
  let hasDuplicate = false;
  for (const display of displays) {
    const slot = matchGallerySlot(display.position);
    if (!slot) return { mode: 'legacy', displays, reason: 'unmatched-position' };
    if (occupants.has(slot.id)) hasDuplicate = true;
    else occupants.set(slot.id, display);
  }
  if (hasDuplicate) return { mode: 'legacy', displays, reason: 'duplicate-slot' };
  return { mode: 'slotted', slots: GALLERY_SLOTS.map(slot => ({ slot, exhibit: occupants.get(slot.id) ?? null })) };
}

/** Đưa tọa độ đã khớp (lệch ≤ sai số) về đúng tâm bục; phòng legacy trả lại nguyên vẹn. */
export function snapDisplaysToSlots(displays: readonly MuseumDisplay[]): MuseumDisplay[] {
  const layout = resolveGalleryLayout(displays);
  if (layout.mode === 'legacy') return [...displays];
  const positions = new Map(layout.slots.flatMap(({ slot, exhibit }) => exhibit ? [[exhibit.id, slot.position] as const] : []));
  return displays.map(display => ({ ...display, position: [...positions.get(display.id)!] as [number, number, number] }));
}

/** Vật cản của bục vật lý — bục trống vẫn chắn đường. */
export function getGallerySlotColliders(slots: readonly GallerySlotDefinition[] = GALLERY_SLOTS): NavigationCollider[] {
  return slots.map(({ position, footprintRadius }) => {
    const radius = footprintRadius + NAVIGATION.bodyRadius;
    return { minX: position[0] - radius, maxX: position[0] + radius, minZ: position[2] - radius, maxZ: position[2] + radius };
  });
}

/**
 * Vật cản theo đúng chế độ của phòng: `slotted` lấy từ 5 bục, `legacy` lấy từ hiện vật như trước.
 * `exceptId` bỏ vật cản của chính hiện vật đang được ngắm (kiểm tra tầm nhìn của tour).
 */
export function getGalleryColliders(displays: readonly MuseumDisplay[], exceptId?: string): NavigationCollider[] {
  const layout = resolveGalleryLayout(displays);
  if (layout.mode === 'legacy') return getDisplayColliders(exceptId ? displays.filter(display => display.id !== exceptId) : displays);
  return getGallerySlotColliders(layout.slots.filter(({ exhibit }) => !exceptId || exhibit?.id !== exceptId).map(({ slot }) => slot));
}

/** Vị trí theo dạng payload của CMS/API. */
export interface SlotPosition { x: number; y: number; z: number }
export interface SlotOccupant { id: string; name: string }

/**
 * Bục nào của phòng đã có hiện vật (CMS). `legacyCount` đếm hiện vật ở tọa độ tự do hoặc trùng bục —
 * còn hiện vật như vậy thì phòng vẫn hiển thị theo bố cục legacy.
 */
export function getSlotOccupancy(exhibits: readonly (SlotOccupant & { position?: SlotPosition | null })[]): {
  bySlot: Map<GallerySlotId, SlotOccupant>; legacyCount: number;
} {
  const bySlot = new Map<GallerySlotId, SlotOccupant>();
  let legacyCount = 0;
  for (const { id, name, position } of exhibits) {
    const slot = position ? matchGallerySlot([Number(position.x), Number(position.y), Number(position.z)]) : null;
    if (!slot || bySlot.has(slot.id)) legacyCount++;
    else bySlot.set(slot.id, { id, name });
  }
  return { bySlot, legacyCount };
}

/** Bục trống đầu tiên theo thứ tự S01 → S05, hoặc `null` khi cả 5 bục đã có hiện vật. */
export function pickFreeSlot(occupied: ReadonlyMap<GallerySlotId, unknown>): GallerySlotDefinition | null {
  return GALLERY_SLOTS.find(slot => !occupied.has(slot.id)) ?? null;
}
