import { makeId, readCollection, writeCollection } from './clientStore';

/**
 * Dịch vụ quản lý bản dịch đa ngôn ngữ song song cho CMS.
 *
 * Mỗi "chuỗi nguồn" (namespace) có một bản dịch cho từng ngôn ngữ đích. Tiếng Việt
 * là ngôn ngữ nguồn (`source`). Hiện lưu phía client (xem clientStore); khi backend
 * có endpoint i18n, chỉ cần thay thân các hàm dưới bằng `http.*`.
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

const STORE_KEY = 'translations';

function seed(): TranslationEntry[] {
  const now = new Date().toISOString();
  const rows: Omit<TranslationEntry, 'id' | 'updatedAt'>[] = [
    {
      namespace: 'exhibit.trong-dong-dong-son.name',
      context: 'Tên hiện vật hiển thị trên thẻ và trang chi tiết',
      category: 'exhibit',
      values: { vi: 'Trống đồng Đông Sơn', en: 'Dong Son Bronze Drum', fr: '', ja: '', zh: '' },
    },
    {
      namespace: 'exhibit.trong-dong-dong-son.description',
      context: 'Mô tả ngắn hiện vật (1-2 câu)',
      category: 'exhibit',
      values: {
        vi: 'Bảo vật biểu trưng cho văn minh Đông Sơn, niên đại khoảng 2.500 năm.',
        en: 'A treasure symbolizing the Dong Son civilization, dated to around 2,500 years ago.',
        fr: '', ja: '', zh: '',
      },
    },
    {
      namespace: 'room.phong-lich-su-quan-su.name',
      context: 'Tên phòng trưng bày',
      category: 'room',
      values: { vi: 'Phòng Lịch Sử Quân Sự Việt Nam', en: 'Vietnam Military History Hall', fr: '', ja: '', zh: '' },
    },
    {
      namespace: 'ui.cta.explore-3d',
      context: 'Nút kêu gọi vào không gian 3D ở trang chủ',
      category: 'ui',
      values: { vi: 'Khám phá Không gian 3D', en: 'Explore the 3D Space', fr: 'Explorer l’espace 3D', ja: '', zh: '' },
    },
    {
      namespace: 'ui.collection.empty',
      context: 'Thông báo khi phòng chưa có hiện vật',
      category: 'ui',
      values: { vi: 'Phòng này chưa có hiện vật được xuất bản.', en: '', fr: '', ja: '', zh: '' },
    },
    {
      namespace: 'audio.trong-dong.intro',
      context: 'Câu mở đầu thuyết minh audio',
      category: 'audio',
      values: { vi: 'Chào mừng bạn đến với không gian trưng bày Trống đồng.', en: '', fr: '', ja: '', zh: '' },
    },
  ];
  return rows.map((row) => ({ ...row, id: makeId('tr'), updatedAt: now }));
}

/** Tỷ lệ hoàn thành (0-1) của một ngôn ngữ đích trên toàn bộ danh sách. */
export function localeProgress(entries: TranslationEntry[], locale: string): number {
  if (entries.length === 0) return 0;
  const done = entries.filter((entry) => (entry.values[locale] ?? '').trim().length > 0).length;
  return done / entries.length;
}

export const translationsService = {
  async list(): Promise<TranslationEntry[]> {
    const rows = await readCollection<TranslationEntry>(STORE_KEY, seed);
    return [...rows].sort((a, b) => a.namespace.localeCompare(b.namespace));
  },

  async create(input: UpsertTranslationInput): Promise<TranslationEntry> {
    const rows = await readCollection<TranslationEntry>(STORE_KEY, seed);
    const entry: TranslationEntry = { ...input, id: makeId('tr'), updatedAt: new Date().toISOString() };
    await writeCollection(STORE_KEY, [entry, ...rows]);
    return entry;
  },

  /** Cập nhật bản dịch cho các ngôn ngữ của một mục. */
  async updateValues(id: string, values: Record<string, string>): Promise<TranslationEntry> {
    const rows = await readCollection<TranslationEntry>(STORE_KEY, seed);
    let updated: TranslationEntry | undefined;
    const next = rows.map((row) => {
      if (row.id !== id) return row;
      updated = { ...row, values: { ...row.values, ...values }, updatedAt: new Date().toISOString() };
      return updated;
    });
    await writeCollection(STORE_KEY, next);
    if (!updated) throw new Error('Không tìm thấy mục bản dịch');
    return updated;
  },

  async remove(id: string): Promise<void> {
    const rows = await readCollection<TranslationEntry>(STORE_KEY, seed);
    await writeCollection(STORE_KEY, rows.filter((row) => row.id !== id));
  },
};
