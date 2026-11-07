import type { RoomTranslationsInput } from '@/services/rooms.service';
import { TARGET_LOCALES } from '@/services/translations.service';

/** Bản dịch trong form phòng, theo từng ngôn ngữ đích. */
export type RoomTranslationValues = Record<string, { name: string; description: string }>;

export function toRoomTranslationValues(translations: RoomTranslationsInput = {}): RoomTranslationValues {
  return Object.fromEntries(TARGET_LOCALES.map(({ code }) => [code, {
    name: translations.name?.[code] ?? '',
    description: translations.description?.[code] ?? '',
  }]));
}

/** Chỉ gửi bản dịch có nội dung, đã trim. */
export function toRoomTranslationsInput(values: RoomTranslationValues): RoomTranslationsInput {
  const pick = (field: 'name' | 'description') => Object.fromEntries(TARGET_LOCALES.flatMap(({ code }) => {
    const text = values[code][field].trim();
    return text ? [[code, text]] : [];
  }));
  return { name: pick('name'), description: pick('description') };
}
