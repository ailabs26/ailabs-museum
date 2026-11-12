import type { MuseumQuality } from './museumQuality';
import { GALLERY_SLOTS, type GallerySlotId } from './gallerySlots';

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
function slotSpot(id: GallerySlotId, kind: 'hero' | 'slot'): GallerySpot {
  const [x, , z] = GALLERY_SLOTS.find(slot => slot.id === id)!.position;
  // Đèn đặt lệch về phía lối vào và tâm phòng: mặt hiện vật hướng ra khách được chiếu, không ngược sáng.
  return { id, position: [x * .78, SPOT_HEIGHT, z + 1.7], target: [x, 1.5, z], ...GALLERY_LIGHTING_PRESET[kind] };
}

/** Đèn chiếu hiện vật theo tier; số đèn cố định, không phụ thuộc số hiện vật của CMS. */
export function getGallerySpots(tier: MuseumQuality['tier']): GallerySpot[] {
  if (tier === 'low') return [slotSpot('S01', 'hero'),
    ...[-1, 1].map((side): GallerySpot => ({ id: side < 0 ? 'left' : 'right', position: [side * 2.6, SPOT_HEIGHT, -1.05], target: [side * 4.3, 1.2, -1.05], ...GALLERY_LIGHTING_PRESET.side }))];
  return GALLERY_SLOTS.map(slot => slotSpot(slot.id, slot.plinthKind === 'hero' ? 'hero' : 'slot'));
}

/** Wall-wash màu là lớp phụ: bỏ ở tier thấp (tường vẫn có dải emissive tĩnh). */
export function getGalleryAccents(tier: MuseumQuality['tier']): readonly GalleryAccent[] {
  return tier === 'low' ? [] : GALLERY_LIGHTING_PRESET.accents;
}
