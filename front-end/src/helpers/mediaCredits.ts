import type { MediaRights, RoomDetail } from '@/validations/roomSchema';

/** Một dòng ghi công cho media của hiện vật (FR-97). */
export interface MediaCredit {
  key?: string;
  label: string;
  source: string | null;
  author: string | null;
  license: string | null;
}

type PublicExhibit = RoomDetail['exhibits'][number];

/** Media cùng nhãn hiển thị; `rights` thiếu (payload cũ) coi như không có thông tin. */
export interface CreditSource {
  id: string;
  /** Mã dịch của nhãn; nhãn tiếng Việt là chữ dự phòng. */
  key?: string;
  label: string;
  rights?: MediaRights | null;
}

const clean = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

/** Bỏ media không có thông tin nào và media trùng id (vd một phụ đề dùng cho hai slot). */
export function toMediaCredits(sources: readonly CreditSource[]): MediaCredit[] {
  const seen = new Set<string>();
  const credits: MediaCredit[] = [];
  for (const { id, key, label, rights } of sources) {
    if (seen.has(id)) continue;
    seen.add(id);
    const credit = { key, label, source: clean(rights?.source), author: clean(rights?.author), license: clean(rights?.license) };
    if (credit.source || credit.author || credit.license) credits.push(credit);
  }
  return credits;
}

/** Ghi công cho mọi media công khai của hiện vật theo thứ tự hiển thị: model, ảnh, audio, phụ đề. */
export function collectMediaCredits(exhibit: PublicExhibit): MediaCredit[] {
  const sources: CreditSource[] = [];
  if (exhibit.model) sources.push({ id: exhibit.model.id, key: 'ui.credits.model', label: 'Mô hình 3D', rights: exhibit.model.rights });
  if (exhibit.image) sources.push({ id: exhibit.image.id, key: 'ui.credits.image', label: 'Hình ảnh', rights: exhibit.image.rights });
  const tracks = [
    { locale: 'vi', audio: { key: 'ui.credits.audio-vi', label: 'Thuyết minh tiếng Việt' }, subtitle: { key: 'ui.credits.subtitle-vi', label: 'Phụ đề tiếng Việt' } },
    { locale: 'en', audio: { key: 'ui.credits.audio-en', label: 'Thuyết minh tiếng Anh' }, subtitle: { key: 'ui.credits.subtitle-en', label: 'Phụ đề tiếng Anh' } },
  ] as const;
  for (const { locale, audio, subtitle } of tracks) {
    const track = exhibit.audio?.[locale];
    if (!track) continue;
    sources.push({ id: track.audio.id, ...audio, rights: track.audio.rights });
    if (track.subtitle) sources.push({ id: track.subtitle.id, ...subtitle, rights: track.subtitle.rights });
  }
  return toMediaCredits(sources);
}
