import {
  EXHIBIT_LABEL_SIZE,
  EXHIBIT_PLINTH_SIZE,
  MUSEUM_ROOM_SIZE,
  type MuseumDisplay,
  type PublicRoomPayload,
} from './museumTypes';

export type GallerySlotId = 'S01' | 'S02' | 'S03' | 'S04' | 'S05';

export interface GallerySlotDefinition {
  id: GallerySlotId;
  labelKey: string;
  label: string;
  /** Mét, Y hướng lên; tâm phòng (0, 0, 0), mặt sàn y = 0. */
  position: readonly [number, 0, number];
  plinthKind: 'hero' | 'standard';
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
 * Nguồn sự thật duy nhất của Gallery Template V1 — đồng bộ hoàn toàn với web (`gallerySlots.ts`).
 */
export const GALLERY_SLOTS: readonly GallerySlotDefinition[] = [
  {
    id: 'S01',
    labelKey: 'ui.slot.center',
    label: 'Bục 01 – Trung tâm',
    position: [0, 0, -2],
    plinthKind: 'hero',
    footprintRadius: EXHIBIT_PLINTH_SIZE.centerpieceRadius,
  },
  {
    id: 'S02',
    labelKey: 'ui.slot.back-left',
    label: 'Bục 02 – Trái sau',
    position: [-4.3, 0, -4.2],
    plinthKind: 'standard',
    footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius,
  },
  {
    id: 'S03',
    labelKey: 'ui.slot.back-right',
    label: 'Bục 03 – Phải sau',
    position: [4.3, 0, -4.2],
    plinthKind: 'standard',
    footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius,
  },
  {
    id: 'S04',
    labelKey: 'ui.slot.front-left',
    label: 'Bục 04 – Trái trước',
    position: [-4.3, 0, 2.1],
    plinthKind: 'standard',
    footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius,
  },
  {
    id: 'S05',
    labelKey: 'ui.slot.front-right',
    label: 'Bục 05 – Phải trước',
    position: [4.3, 0, 2.1],
    plinthKind: 'standard',
    footprintRadius: EXHIBIT_PLINTH_SIZE.roundRadius,
  },
];

/** Sai số khớp tọa độ với tâm bục (5 cm). */
export const GALLERY_SLOT_TOLERANCE = 0.05;

/** Kiểm tra một hiện vật (cả bục + bao mô hình + nhãn) có vượt ra khỏi vỏ phòng 14x16x5 m không. */
export function isDisplayOutsideRoom(
  display: Pick<MuseumDisplay, 'position' | 'shape' | 'model'>,
): boolean {
  const [x, y, z] = display.position;
  const isLarge = !!display.model || display.shape === 'torus';
  const radius = isLarge ? 1.5 : 1;
  const height = display.model ? 3.34 : display.shape === 'torus' ? 3.2 : 2.4;
  const labelDepth = isLarge ? EXHIBIT_LABEL_SIZE.centerpieceDepth : EXHIBIT_LABEL_SIZE.depth;
  const frontExtent = Math.max(radius, labelDepth + EXHIBIT_LABEL_SIZE.width / 2);
  return (
    Math.abs(x) + radius > MUSEUM_ROOM_SIZE.width / 2 ||
    z - radius < -MUSEUM_ROOM_SIZE.depth / 2 ||
    z + frontExtent > MUSEUM_ROOM_SIZE.depth / 2 ||
    y < 0 ||
    y + height > MUSEUM_ROOM_SIZE.height
  );
}

/** Khớp tọa độ XYZ với 1 trong 5 bục Gallery Template, hoặc `null` nếu là tọa độ tự do. */
export function matchGallerySlot(
  position: readonly [number, number, number],
): GallerySlotDefinition | null {
  const [x, y, z] = position;
  if (![x, y, z].every(Number.isFinite) || Math.abs(y) > GALLERY_SLOT_TOLERANCE) return null;
  return (
    GALLERY_SLOTS.find(
      (slot) =>
        Math.abs(x - slot.position[0]) <= GALLERY_SLOT_TOLERANCE &&
        Math.abs(z - slot.position[2]) <= GALLERY_SLOT_TOLERANCE,
    ) ?? null
  );
}

/**
 * Phòng rỗng hoặc mọi hiện vật khớp duy nhất 1 bục -> `slotted` (giữ đủ 5 bục vật lý).
 * Ngược lại -> `legacy` (giữ nguyên toàn bộ hiện vật ở tọa độ gốc, không cắt/ẩn).
 */
export function resolveGalleryLayout(
  displays: readonly MuseumDisplay[],
): GalleryLayoutResolution {
  if (displays.length > GALLERY_SLOTS.length) {
    return { mode: 'legacy', displays, reason: 'too-many-exhibits' };
  }
  const occupants = new Map<GallerySlotId, MuseumDisplay>();
  let hasDuplicate = false;
  for (const display of displays) {
    const slot = matchGallerySlot(display.position);
    if (!slot) return { mode: 'legacy', displays, reason: 'unmatched-position' };
    if (occupants.has(slot.id)) hasDuplicate = true;
    else occupants.set(slot.id, display);
  }
  if (hasDuplicate) return { mode: 'legacy', displays, reason: 'duplicate-slot' };
  return {
    mode: 'slotted',
    slots: GALLERY_SLOTS.map((slot) => ({ slot, exhibit: occupants.get(slot.id) ?? null })),
  };
}

/** Kéo các hiện vật khớp bục (lệch ≤ 5 cm) về đúng tâm bục; phòng legacy giữ nguyên tọa độ. */
export function snapDisplaysToSlots(displays: readonly MuseumDisplay[]): MuseumDisplay[] {
  const layout = resolveGalleryLayout(displays);
  if (layout.mode === 'legacy') return [...displays];
  const positions = new Map<string, readonly [number, 0, number]>();
  for (const { slot, exhibit } of layout.slots) {
    if (exhibit) positions.set(exhibit.id, slot.position);
  }
  return displays.map((display) => {
    const snapped = positions.get(display.id);
    return snapped ? { ...display, position: [snapped[0], snapped[1], snapped[2]] } : display;
  });
}

/**
 * Ánh xạ payload API công khai `/rooms/:slug` sang danh sách `MuseumDisplay` ổn định theo `displayOrder`,
 * có fallback ngôn ngữ về tiếng Việt và tự snap tọa độ vào bục chuẩn khi hợp lệ.
 */
export function mapRoomDisplays(
  room: Pick<PublicRoomPayload, 'id' | 'exhibits'>,
  locale: 'vi' | 'en' | 'fr' | 'zh' | 'ko' | 'ja' = 'vi',
): MuseumDisplay[] {
  const sorted = [...room.exhibits].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  const hasModels = sorted.some((exhibit) => Boolean(exhibit.model));
  const columns = hasModels
    ? Math.min(4, Math.max(1, Math.ceil(Math.sqrt(sorted.length))))
    : Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const rows = Math.max(1, Math.ceil(sorted.length / columns));

  return snapDisplaysToSlots(
    sorted.map((source, index) => {
      const localized = source.i18n?.[locale];
      const viFallback = source.i18n?.vi;
      const title = localized?.name?.trim() || viFallback?.name?.trim() || source.name;
      const description =
        localized?.description?.trim() || viFallback?.description?.trim() || source.description;

      const hasCoords =
        source.positionX !== undefined &&
        source.positionY !== undefined &&
        source.positionZ !== undefined;

      const position: [number, number, number] = hasCoords
        ? [source.positionX!, source.positionY!, source.positionZ!]
        : hasModels
          ? [
              ((index % columns) - (columns - 1) / 2) * 3.6,
              0,
              (Math.floor(index / columns) - (rows - 1) / 2) * 3.6,
            ]
          : [
              columns === 1 ? 0 : -5.3 + ((index % columns) * 10.6) / (columns - 1),
              0,
              rows === 1 ? 0 : -5.1 + (Math.floor(index / columns) * 10.2) / (rows - 1),
            ];

      const display: MuseumDisplay = {
        id: source.id,
        revisionId: source.revisionId,
        roomId: room.id,
        title,
        description,
        position,
        ...(source.rotation
          ? { rotation: [source.rotation.x, source.rotation.y, source.rotation.z] }
          : {}),
        ...(source.scale ? { scale: [source.scale.x, source.scale.y, source.scale.z] } : {}),
        shape: source.placeholderShape === 'box' ? 'cube' : source.placeholderShape,
        color: source.placeholderColor,
        ...(source.model ? { model: source.model } : {}),
        ...(source.hotspots
          ? {
              hotspots: [...source.hotspots]
                .sort(
                  (left, right) =>
                    left.displayOrder - right.displayOrder ||
                    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
                )
                .map(({ id, label, body, positionX, positionY, positionZ }) => ({
                  id,
                  label,
                  body,
                  position: [positionX, positionY, positionZ] as [number, number, number],
                })),
            }
          : {}),
      };

      return { ...display, isOutsideRoom: isDisplayOutsideRoom(display) };
    }),
  );
}
