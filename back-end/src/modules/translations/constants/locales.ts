/** Mã ngôn ngữ hỗ trợ cho i18n (vi là nguồn). Đồng bộ với FE translations.service.ts. */
export const SUPPORTED_LOCALES = ['vi', 'en', 'fr', 'ja', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

/**
 * Lọc & chuẩn hóa map bản dịch từ client: chỉ giữ locale hợp lệ, ép giá trị về
 * chuỗi (cắt khoảng trắng thừa). Tránh lưu khóa rác hay kiểu dữ liệu lạ vào jsonb.
 */
export function sanitizeValues(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [locale, value] of Object.entries(input ?? {})) {
    if (!LOCALE_SET.has(locale)) continue;
    if (typeof value !== 'string') continue;
    out[locale] = value.trim();
  }
  return out;
}
