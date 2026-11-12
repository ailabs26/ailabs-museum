/**
 * Gallery Template V1: 5 bục cố định của phòng 3D (mét, Y hướng lên, gốc tại tâm phòng).
 * Phải khớp `GALLERY_SLOTS` ở `front-end/src/helpers/gallerySlots.ts` — V1 lưu bục bằng chính tọa độ
 * `position` của revision, chưa có cột `slotId` riêng.
 */
export const GALLERY_SLOTS = [
  { id: 'S01', label: 'Bục 01 – Trung tâm', x: 0, z: -2 },
  { id: 'S02', label: 'Bục 02 – Trái sau', x: -4.3, z: -4.2 },
  { id: 'S03', label: 'Bục 03 – Phải sau', x: 4.3, z: -4.2 },
  { id: 'S04', label: 'Bục 04 – Trái trước', x: -4.3, z: 2.1 },
  { id: 'S05', label: 'Bục 05 – Phải trước', x: 4.3, z: 2.1 },
] as const;

export type GallerySlot = (typeof GALLERY_SLOTS)[number];

/** Sai số khớp tọa độ với bục (mét), giống phía front-end. */
export const GALLERY_SLOT_TOLERANCE = 0.05;

/** Bục ứng với tọa độ, hoặc `null` nếu là tọa độ tự do (phòng legacy — không ràng buộc). */
export function matchGallerySlot(position: unknown): GallerySlot | null {
  if (!position || typeof position !== 'object') return null;
  const { x, y, z } = position as Record<string, unknown>;
  const [px, py, pz] = [Number(x), Number(y), Number(z)];
  if (x === null || y === null || z === null || ![px, py, pz].every(Number.isFinite)) return null;
  if (Math.abs(py) > GALLERY_SLOT_TOLERANCE) return null;
  return (
    GALLERY_SLOTS.find(
      (slot) =>
        Math.abs(px - slot.x) <= GALLERY_SLOT_TOLERANCE &&
        Math.abs(pz - slot.z) <= GALLERY_SLOT_TOLERANCE,
    ) ?? null
  );
}
