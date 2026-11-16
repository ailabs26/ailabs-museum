import { SUPPORTED_LOCALES, SupportedLocale } from '../../translations/constants/locales';

/** Văn bản đa ngôn ngữ đã chuẩn hóa: đủ mọi ngôn ngữ, thiếu thì `null`. */
export type BilingualValue = Record<SupportedLocale, string | null>;

/** Chuỗi có nội dung (sau trim) thì giữ nguyên, ngược lại `null`. */
function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function fromObject(value: Record<string, unknown>): BilingualValue {
  return Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, textOrNull(value[locale])])) as BilingualValue;
}

/**
 * Chuẩn hóa văn bản đa ngôn ngữ lưu trong revision về đủ các khóa của `BilingualValue`.
 *
 * Dữ liệu thật có ba dạng:
 * - chuỗi thường (seed/dữ liệu cũ) → coi là tiếng Việt;
 * - object `{ vi, en, ... }` trong JSONB `content` (CMS);
 * - chuỗi JSON `'{"vi":…,"en":…}'` khi object song ngữ được ghi vào cột varchar/text
 *   (hotspot `label`/`body`) — driver pg serialize object bằng JSON.stringify.
 */
export function resolveBilingual(value: unknown): BilingualValue {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && SUPPORTED_LOCALES.some((locale) => locale in parsed)) {
          return fromObject(parsed as Record<string, unknown>);
        }
      } catch {
        // Không phải JSON hợp lệ: là văn bản thường bắt đầu bằng "{".
      }
    }
    return fromObject({ vi: value });
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return fromObject(value as Record<string, unknown>);
  }
  return fromObject({});
}

/** Văn bản hiển thị mặc định: tiếng Việt, thiếu thì tiếng Anh. */
export function primaryText(value: Pick<BilingualValue, 'vi' | 'en'>): string | null {
  return value.vi ?? value.en;
}

/** Văn bản theo ngôn ngữ yêu cầu, thiếu thì về tiếng Việt rồi tiếng Anh; `locale` là ngôn ngữ thật của `text`. */
export function pickLocale(
  value: BilingualValue,
  lang: SupportedLocale,
): { text: string | null; locale: SupportedLocale | null } {
  const locale = ([lang, 'vi', 'en'] as const).find((candidate) => value[candidate] !== null) ?? null;
  return { text: locale ? value[locale] : null, locale };
}
