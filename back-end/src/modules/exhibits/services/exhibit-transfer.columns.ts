/**
 * Task 38 — định nghĩa cột cho xuất/nhập hiện vật hàng loạt (CSV và JSON dùng chung một bộ khóa phẳng).
 *
 * - Cột chỉ đọc (`id`, `status`, `visibility`, `revisionState`) có trong file xuất để người dùng đối
 *   chiếu; khi nhập chúng bị BỎ QUA — nhập luôn tạo hiện vật MỚI ở trạng thái Draft, không ghi đè và
 *   không tự xuất bản (vẫn phải qua kiểm duyệt).
 * - Cột còn lại ánh xạ 1–1 sang `CreateExhibitDto`, nên mọi quy tắc validate của form tạo hiện vật
 *   áp dụng y nguyên cho từng dòng.
 */
import { SUPPORTED_LOCALES } from '../../translations/constants/locales';
import type { ExhibitAdminResponse } from '../dto/exhibit-response.dto';

export type TransferRecord = Record<string, string>;

/** Cột chỉ có ý nghĩa khi xuất. */
export const READ_ONLY_COLUMNS = ['id', 'status', 'visibility', 'revisionState'] as const;

const LOCALIZED_FIELDS = ['name', 'description', 'transcript', 'altText'] as const;
const VECTOR_FIELDS = ['position', 'rotation', 'scale'] as const;
const AXES = ['X', 'Y', 'Z'] as const;
const MEDIA_FIELDS = ['modelId', 'imageId', 'audioViId', 'audioEnId', 'subtitleViId', 'subtitleEnId'] as const;

/** Cột số: không thêm `'` chống công thức khi xuất (giữ `-4` nhập ngược lại được). */
export const NUMERIC_COLUMNS = new Set<string>([
  'displayOrder',
  ...VECTOR_FIELDS.flatMap((field) => AXES.map((axis) => `${field}${axis}`)),
]);

/** Thứ tự cột trong file xuất (cũng là tập cột được chấp nhận khi nhập). */
export const TRANSFER_COLUMNS: readonly string[] = [
  ...READ_ONLY_COLUMNS,
  'roomSlug',
  'roomId',
  'displayOrder',
  ...LOCALIZED_FIELDS.flatMap((field) => SUPPORTED_LOCALES.map((locale) => `${field}_${locale}`)),
  ...VECTOR_FIELDS.flatMap((field) => AXES.map((axis) => `${field}${axis}`)),
  'placeholderShape',
  'placeholderColor',
  ...MEDIA_FIELDS,
];

const KNOWN_COLUMNS = new Set(TRANSFER_COLUMNS);

/** Cột lạ trong file nhập (để báo lỗi cấp file thay vì âm thầm bỏ qua dữ liệu người dùng gõ). */
export function unknownColumns(headers: readonly string[]): string[] {
  return headers.filter((header) => !KNOWN_COLUMNS.has(header));
}

/** Nội dung đa ngôn ngữ lưu dạng chuỗi (dữ liệu cũ) hoặc `{ vi, en, ... }` → map theo locale. */
function localeValues(value: unknown): Partial<Record<string, string>> {
  if (typeof value === 'string') return value ? { vi: value } : {};
  if (!value || typeof value !== 'object') return {};
  const out: Partial<Record<string, string>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const text = (value as Record<string, unknown>)[locale];
    if (typeof text === 'string' && text) out[locale] = text;
  }
  return out;
}

function numberText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

/** Một hiện vật (revision mới nhất) → một dòng phẳng; ô trống là chuỗi rỗng. */
export function exhibitToRecord(exhibit: ExhibitAdminResponse, roomSlug: string | null): TransferRecord {
  const content = exhibit.content;
  const record: TransferRecord = {
    id: exhibit.id,
    status: exhibit.status,
    visibility: exhibit.visibility,
    revisionState: exhibit.revisionState,
    roomSlug: roomSlug ?? '',
    roomId: exhibit.roomId,
    displayOrder: String(exhibit.displayOrder),
    placeholderShape: content.placeholderShape ?? '',
    placeholderColor: content.placeholderColor ?? '',
  };
  const localized: Record<(typeof LOCALIZED_FIELDS)[number], unknown> = {
    name: content.name,
    description: content.description,
    transcript: content.transcript,
    altText: content.altText,
  };
  for (const field of LOCALIZED_FIELDS) {
    const values = localeValues(localized[field]);
    for (const locale of SUPPORTED_LOCALES) record[`${field}_${locale}`] = values[locale] ?? '';
  }
  for (const field of VECTOR_FIELDS) {
    const vector = content[field] as Record<string, unknown> | undefined;
    for (const axis of AXES) record[`${field}${axis}`] = numberText(vector?.[axis.toLowerCase()]);
  }
  for (const field of MEDIA_FIELDS) {
    const id = content[field] ?? (field === 'audioViId' ? content.audioId : undefined);
    record[field] = typeof id === 'string' ? id : '';
  }
  return record;
}

/**
 * Một dòng nhập → object thô cho `CreateExhibitDto` (chưa validate). Ô trống bị bỏ (= không gửi
 * trường đó); `roomId` do service điền sau khi tra `roomSlug`.
 */
export function recordToCreateInput(record: TransferRecord): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  const has = (key: string) => record[key] !== undefined && record[key].trim() !== '';

  if (has('roomId')) input.roomId = record.roomId.trim();
  if (has('displayOrder')) input.displayOrder = record.displayOrder.trim();
  for (const field of LOCALIZED_FIELDS) {
    const values: Record<string, string> = {};
    for (const locale of SUPPORTED_LOCALES) {
      const key = `${field}_${locale}`;
      if (has(key)) values[locale] = record[key];
    }
    if (Object.keys(values).length > 0) input[field] = values;
  }
  for (const field of VECTOR_FIELDS) {
    for (const axis of AXES) {
      const key = `${field}${axis}`;
      if (has(key)) input[key] = record[key].trim();
    }
  }
  for (const key of ['placeholderShape', 'placeholderColor', ...MEDIA_FIELDS]) {
    if (has(key)) input[key] = record[key].trim();
  }
  return input;
}
