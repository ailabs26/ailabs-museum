import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { ExhibitDetail, RevisionMediaSlot } from '@/services/exhibits.service';
import type { MediaItem } from '@/services/media.service';
import type { PublicModel } from '@/validations/roomSchema';
import { resolveBilingualText } from './exhibitHotspots';
import { isDisplayOutsideRoom } from './isDisplayOutsideRoom';
import { toMediaCredits } from './mediaCredits';

export type PreviewLocale = 'vi' | 'en';

/** Slot media của revision theo thứ tự ghi công của tour (`collectMediaCredits`). */
const CREDIT_SLOTS: { slot: RevisionMediaSlot; label: string }[] = [
  { slot: 'model', label: 'Mô hình 3D' },
  { slot: 'image', label: 'Hình ảnh' },
  { slot: 'audioVi', label: 'Thuyết minh tiếng Việt' },
  { slot: 'subtitleVi', label: 'Phụ đề tiếng Việt' },
  { slot: 'audioEn', label: 'Thuyết minh tiếng Anh' },
  { slot: 'subtitleEn', label: 'Phụ đề tiếng Anh' },
];

/** Ghi công từ quyền sử dụng của media đang gắn vào bản nháp — để preview hiện như tour công khai. */
function draftCredits(detail: ExhibitDetail) {
  return toMediaCredits(
    CREDIT_SLOTS.flatMap(({ slot, label }) => {
      const media = detail.media?.[slot];
      return media ? [{ id: media.id, label, rights: { source: media.source, author: media.author, license: media.license } }] : [];
    }),
  );
}

const SHAPES: Record<string, MuseumDisplay['shape']> = {
  box: 'cube',
  sphere: 'sphere',
  cylinder: 'cylinder',
  cone: 'cone',
  torus: 'torus',
};

/** Chỉ đúng một ngôn ngữ — preview cần lộ ra chỗ còn thiếu bản dịch thay vì lấy ngôn ngữ kia thế vào. */
function pick(value: unknown, locale: PreviewLocale): string {
  return resolveBilingualText(value)[locale].trim();
}

/**
 * Model của bản nháp theo hợp đồng tour (`loadMuseumModel`): tải qua API admin đã xác thực và
 * vẫn kiểm checksum SHA-256 + kích thước như khách tham quan.
 */
export function toPreviewModel(media: MediaItem): PublicModel {
  return {
    id: media.id,
    storageKey: `${media.id}.glb`,
    sizeBytes: media.sizeBytes,
    checksumSha256: media.checksumSha256,
    url: `/admin/media/${media.id}/content`,
  };
}

/**
 * Bản nháp (revision mới nhất trong chi tiết admin) → display của scene tour, theo một ngôn ngữ.
 * `model` là media GLB đang gắn (cần checksum); `null` = khối thay thế như tour.
 */
export function toDraftDisplay(detail: ExhibitDetail, model: MediaItem | null, locale: PreviewLocale): MuseumDisplay {
  const { content } = detail;
  const missing = locale === 'vi' ? '(Chưa có tiếng Việt)' : '(No English text yet)';
  const image = detail.media?.image;
  const position = content.position ?? { x: 0, y: 0, z: 0 };
  const display: MuseumDisplay = {
    id: detail.id,
    roomId: detail.roomId,
    title: pick(content.name, locale) || missing,
    description: pick(content.description, locale),
    transcript: pick(content.transcript, locale) || null,
    ...(image?.url ? { image: { url: image.url, alt: pick(content.altText, locale) || missing } } : {}),
    hotspots: [...detail.hotspots]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((hotspot) => ({
        id: hotspot.id,
        label: pick(hotspot.label, locale) || missing,
        body: pick(hotspot.body, locale),
        position: [Number(hotspot.position.x), Number(hotspot.position.y), Number(hotspot.position.z)],
      })),
    position: [position.x, position.y, position.z],
    shape: SHAPES[content.placeholderShape ?? 'box'] ?? 'cube',
    color: content.placeholderColor ?? '#8b7355',
    ...(model ? { model: toPreviewModel(model) } : {}),
    credits: draftCredits(detail),
  };
  return { ...display, isOutsideRoom: isDisplayOutsideRoom(display) };
}

/**
 * Đặt bản nháp vào phòng như khách sẽ thấy: thay bản đã xuất bản cùng id (hoặc thêm mới). Bản nháp đứng
 * đầu danh sách để bộ tải model của phòng (2 luồng, theo thứ tự) tải model của nó trước các model khác.
 */
export function mergeDraftIntoRoom(roomDisplays: readonly MuseumDisplay[], draft: MuseumDisplay): MuseumDisplay[] {
  return [draft, ...roomDisplays.filter((display) => display.id !== draft.id)];
}
