import { MediaKind } from '../../media/entities/media.entity';

export type ContentLocale = 'vi' | 'en';

/**
 * Các slot media của một revision — nguồn sự thật duy nhất cho: kiểm tra khi gắn media,
 * cổng Submit/Publish, đếm tham chiếu BR-21, public API và phân phối file.
 * Thêm slot mới chỉ cần thêm một dòng ở đây (cùng cột trong entity + migration).
 */
export const REVISION_MEDIA_SLOTS = [
  { key: 'model', label: 'Model 3D', column: 'modelMediaId', relation: 'modelMedia', dbColumn: 'model_media_id', dtoField: 'modelId', kind: MediaKind.MODEL, locale: null },
  { key: 'image', label: 'Hình ảnh', column: 'imageMediaId', relation: 'imageMedia', dbColumn: 'image_media_id', dtoField: 'imageId', kind: MediaKind.IMAGE, locale: null },
  { key: 'audioVi', label: 'Audio (vi)', column: 'audioMediaId', relation: 'audioMedia', dbColumn: 'audio_media_id', dtoField: 'audioViId', kind: MediaKind.AUDIO, locale: 'vi' },
  { key: 'audioEn', label: 'Audio (en)', column: 'audioEnMediaId', relation: 'audioEnMedia', dbColumn: 'audio_en_media_id', dtoField: 'audioEnId', kind: MediaKind.AUDIO, locale: 'en' },
  { key: 'subtitleVi', label: 'Phụ đề (vi)', column: 'subtitleViMediaId', relation: 'subtitleViMedia', dbColumn: 'subtitle_vi_media_id', dtoField: 'subtitleViId', kind: MediaKind.SUBTITLE, locale: 'vi' },
  { key: 'subtitleEn', label: 'Phụ đề (en)', column: 'subtitleEnMediaId', relation: 'subtitleEnMedia', dbColumn: 'subtitle_en_media_id', dtoField: 'subtitleEnId', kind: MediaKind.SUBTITLE, locale: 'en' },
] as const;

export type RevisionMediaSlot = (typeof REVISION_MEDIA_SLOTS)[number];
export type RevisionMediaSlotKey = RevisionMediaSlot['key'];
export type RevisionMediaColumn = RevisionMediaSlot['column'];
export type RevisionMediaDtoField = RevisionMediaSlot['dtoField'];

/** `relations` TypeORM nạp đủ 6 slot media của revision. */
export const REVISION_MEDIA_RELATIONS = Object.fromEntries(
  REVISION_MEDIA_SLOTS.map((slot) => [slot.relation, true]),
) as Record<RevisionMediaSlot['relation'], true>;

/** Id media của từng slot đang có giá trị (bỏ slot trống). */
export function revisionMediaRefs(
  revision: Partial<Record<RevisionMediaColumn, string | null>>,
): Array<{ slot: RevisionMediaSlot; mediaId: string }> {
  return REVISION_MEDIA_SLOTS.flatMap((slot) => {
    const mediaId = revision[slot.column];
    return mediaId ? [{ slot, mediaId }] : [];
  });
}
