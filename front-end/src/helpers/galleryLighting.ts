import type { MuseumQuality } from './museumQuality';
import { GALLERY_SLOTS } from './gallerySlots';

type Point = [number, number, number];
export interface GallerySpot { id: string; position: Point; target: Point; color: string; intensity: number; angle: number; penumbra: number; distance: number }
export interface GalleryAccent { id: string; position: Point; color: string; intensity: number; distance: number }

/**
 * Light rig «Heritage Warm» của Gallery Template: mọi thông số ánh sáng nằm ở đây, không rải magic number.
 * Giá trị được chỉnh bằng ảnh chụp dưới ACES + sRGB của renderer hiện tại; đổi tone mapping/texture thì phải chỉnh lại.
 * Chỉ `key` đổ bóng. Đèn màu (jade/xanh lam) chỉ hắt tường phụ, không chiếu vào hiện vật.
 */
export const GALLERY_LIGHTING_PRESET = {
  environmentIntensity: .42,
  ambient: { color: '#f4f1e8', intensity: .1 },
  hemisphere: { sky: '#f6efe2', ground: '#7d7362', intensity: .42 },
  key: { color: '#ffe8cc', intensity: 1.25, position: [-3.5, 4.8, 4] as Point },
  hero: { color: '#ffe8cc', intensity: 64, angle: .5, penumbra: .9, distance: 9 },
  slot: { color: '#ffe8cc', intensity: 38, angle: .5, penumbra: 1, distance: 8 },
  /** Tier thấp: một đèn rộng cho mỗi cặp bục cạnh thay vì bốn đèn riêng. */
  side: { color: '#ffe8cc', intensity: 46, angle: .95, penumbra: 1, distance: 11 },
  accents: [
    { id: 'jade', position: [-6.1, 2.7, -1.05], color: '#3d9a87', intensity: 5, distance: 6 },
    { id: 'midnight-blue', position: [6.1, 2.7, -1.05], color: '#486a87', intensity: 6, distance: 6 },
  ] as GalleryAccent[],
} as const;

const SPOT_HEIGHT = 4.7;
/** Đèn chiếu treo trong trần, không sát tường trước/sau. */
const SPOT_Z_LIMIT = 7.4;
/** Điểm cần chiếu sáng: tâm bục (phòng theo template) hoặc vị trí thật của hiện vật (phòng legacy). */
export interface GalleryLightTarget { id: string; position: readonly [number, number, number]; isHero: boolean }

/** Bục của Gallery Template là điểm chiếu mặc định. */
export const GALLERY_SLOT_TARGETS: readonly GalleryLightTarget[] = GALLERY_SLOTS.map(slot =>
  ({ id: slot.id, position: slot.position, isHero: slot.plinthKind === 'hero' }));

function aimAt({ id, position: [x, y, z], isHero }: GalleryLightTarget): GallerySpot {
  // Đèn đặt lệch về phía lối vào và tâm phòng: mặt hiện vật hướng ra khách được chiếu, không ngược sáng.
  const spotZ = Math.max(-SPOT_Z_LIMIT, Math.min(SPOT_Z_LIMIT, z + 1.7));
  return { id, position: [x * .78, SPOT_HEIGHT, spotZ], target: [x, y + 1.5, z], ...GALLERY_LIGHTING_PRESET[isHero ? 'hero' : 'slot'] };
}

/** Tier thấp hoặc quá nhiều hiện vật: một đèn trung tâm + hai đèn rộng cho hai dãy bên, không tăng theo số hiện vật. */
function broadSpots(): GallerySpot[] {
  return [aimAt(GALLERY_SLOT_TARGETS[0]),
    ...[-1, 1].map((side): GallerySpot => ({ id: side < 0 ? 'left' : 'right', position: [side * 2.6, SPOT_HEIGHT, -1.05], target: [side * 4.3, 1.2, -1.05], ...GALLERY_LIGHTING_PRESET.side }))];
}

/**
 * Đèn chiếu hiện vật theo tier: tối đa 5 đèn, không phụ thuộc số hiện vật của CMS.
 * Phòng legacy truyền vị trí hiện vật thật; trên 5 điểm thì dùng bộ đèn rộng.
 */
export function getGallerySpots(tier: MuseumQuality['tier'], targets: readonly GalleryLightTarget[] = GALLERY_SLOT_TARGETS): GallerySpot[] {
  return tier === 'low' || targets.length > GALLERY_SLOTS.length ? broadSpots() : targets.map(aimAt);
}

/** Khoảng cách tối thiểu từ đèn hắt màu tới hiện vật: màu chỉ nhuộm tường, không nhuộm hiện vật. */
export const ACCENT_CLEARANCE = 1.8;

/** Wall-wash màu là lớp phụ: bỏ ở tier thấp và bỏ đèn nào đứng gần hiện vật (tường vẫn có dải nhuộm tĩnh). */
export function getGalleryAccents(tier: MuseumQuality['tier'], targets: readonly GalleryLightTarget[] = GALLERY_SLOT_TARGETS): readonly GalleryAccent[] {
  if (tier === 'low') return [];
  return GALLERY_LIGHTING_PRESET.accents.filter(accent => targets.every(({ position: [x, , z] }) =>
    Math.hypot(accent.position[0] - x, accent.position[2] - z) >= ACCENT_CLEARANCE));
}
