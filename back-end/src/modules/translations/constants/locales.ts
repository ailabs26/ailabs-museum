/** Mã ngôn ngữ hỗ trợ cho i18n (vi là nguồn). Đồng bộ với FE translations.service.ts. */
export const SUPPORTED_LOCALES = ['vi', 'en', 'fr', 'zh', 'ko', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Ngôn ngữ không bắt buộc khi gửi duyệt nội dung hiện vật: thiếu thì tự về tiếng Việt. */
export const OPTIONAL_CONTENT_LOCALES = ['fr', 'zh', 'ko', 'ja'] as const;

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  vi: 'Tiếng Việt', en: 'Tiếng Anh', fr: 'Tiếng Pháp', zh: 'Tiếng Trung', ko: 'Tiếng Hàn', ja: 'Tiếng Nhật',
};

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
