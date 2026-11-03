import { http } from '@/core/api/http-client';

/**
 * Dịch vụ quản lý bản dịch đa ngôn ngữ song song cho CMS.
 *
 * Mỗi "chuỗi nguồn" (namespace) có một bản dịch cho từng ngôn ngữ đích. Tiếng Việt
 * là ngôn ngữ nguồn (`source`). Dữ liệu lưu ở backend (bảng `translations`) qua
 * các endpoint `/translations`.
 */

export interface LocaleMeta {
  code: string;
  label: string;
  /** Cờ emoji để nhận diện nhanh trong UI. */
  flag: string;
  /** Ngôn ngữ nguồn (không cần dịch, dùng làm gốc đối chiếu). */
  source?: boolean;
}

/** Danh sách ngôn ngữ hỗ trợ — vi là nguồn, còn lại là đích. */
export const LOCALES: readonly LocaleMeta[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', source: true },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export const SOURCE_LOCALE = 'vi';
export const TARGET_LOCALES = LOCALES.filter((locale) => !locale.source);

export type TranslationCategory = 'exhibit' | 'room' | 'ui' | 'audio';

export const CATEGORY_LABELS: Record<TranslationCategory, string> = {
  exhibit: 'Hiện vật',
  room: 'Phòng trưng bày',
  ui: 'Giao diện',
  audio: 'Thuyết minh',
};

export interface TranslationEntry {
  id: string;
  /** Khóa định danh ổn định, vd 'exhibit.trong-dong.name'. */
  namespace: string;
  /** Gợi ý ngữ cảnh cho người dịch. */
  context: string;
  category: TranslationCategory;
  /** Bản dịch theo mã ngôn ngữ; khóa 'vi' là nội dung nguồn. */
  values: Record<string, string>;
  updatedAt: string;
}

export interface UpsertTranslationInput {
  namespace: string;
  context: string;
  category: TranslationCategory;
  values: Record<string, string>;
}

/** Tỷ lệ hoàn thành (0-1) của một ngôn ngữ đích trên toàn bộ danh sách. */
export function localeProgress(entries: TranslationEntry[], locale: string): number {
  if (entries.length === 0) return 0;
  const done = entries.filter((entry) => (entry.values[locale] ?? '').trim().length > 0).length;
  return done / entries.length;
}

export const translationsService = {
  list(): Promise<TranslationEntry[]> {
    return http.get<TranslationEntry[]>('/translations');
  },

  create(input: UpsertTranslationInput): Promise<TranslationEntry> {
    return http.post<TranslationEntry>('/translations', input);
  },

  /** Cập nhật bản dịch cho các ngôn ngữ của một mục. */
  updateValues(id: string, values: Record<string, string>): Promise<TranslationEntry> {
    return http.patch<TranslationEntry>(`/translations/${id}`, { values });
  },

  remove(id: string): Promise<void> {
    return http.delete<void>(`/translations/${id}`);
  },
};
