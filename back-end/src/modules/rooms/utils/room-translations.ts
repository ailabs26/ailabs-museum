import { pickLocale, resolveBilingual } from '../../exhibits/utils/bilingual';
import { SUPPORTED_LOCALES, SupportedLocale } from '../../translations/constants/locales';
import type { RoomTranslationsDto } from '../dto/room-translations.dto';
import type { Room, RoomTranslations } from '../entities/room.entity';

/** Chỉ giữ bản dịch có nội dung, bỏ `vi`: tiếng Việt nằm ở `name`, `description`. */
function filled(value: object | undefined): Partial<Record<SupportedLocale, string>> {
  const source = (value ?? {}) as Record<string, unknown>;
  return Object.fromEntries(SUPPORTED_LOCALES.flatMap((locale) => {
    const text = source[locale];
    return locale !== 'vi' && typeof text === 'string' && text.trim() ? [[locale, text.trim()]] : [];
  }));
}

export function sanitizeRoomTranslations(dto: RoomTranslationsDto | undefined): RoomTranslations {
  return { name: filled(dto?.name), description: filled(dto?.description) };
}

export interface PublicRoomText {
  /** Theo `lang` nếu có, thiếu thì tiếng Việt; không có `lang` là tiếng Việt như cũ. */
  name: string;
  description: string | null;
  i18n: Record<SupportedLocale, { name: string | null; description: string | null }>;
  /** Chỉ có khi gọi với `lang`: ngôn ngữ thật của `name`. */
  contentLocale?: SupportedLocale | null;
}

/** Văn bản công khai của phòng theo ngôn ngữ. */
export function toPublicRoomText(room: Pick<Room, 'name' | 'description' | 'translations'>, lang?: SupportedLocale): PublicRoomText {
  const name = resolveBilingual({ ...room.translations?.name, vi: room.name });
  const description = resolveBilingual({ ...room.translations?.description, vi: room.description });
  const displayName = pickLocale(name, lang ?? 'vi');
  return {
    name: displayName.text ?? room.name,
    description: pickLocale(description, lang ?? 'vi').text,
    i18n: Object.fromEntries(SUPPORTED_LOCALES.map((locale) => (
      [locale, { name: name[locale], description: description[locale] }]
    ))) as PublicRoomText['i18n'],
    ...(lang ? { contentLocale: displayName.locale } : {}),
  };
}
