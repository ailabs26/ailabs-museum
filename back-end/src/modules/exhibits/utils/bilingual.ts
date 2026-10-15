export interface BilingualValue {
  vi: string | null;
  en: string | null;
}

/** Chuỗi có nội dung (sau trim) thì giữ nguyên, ngược lại `null`. */
function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function fromObject(value: Record<string, unknown>): BilingualValue {
  return { vi: textOrNull(value.vi), en: textOrNull(value.en) };
}

/**
 * Chuẩn hóa văn bản song ngữ lưu trong revision về `{ vi, en }`.
 *
 * Dữ liệu thật có ba dạng:
 * - chuỗi thường (seed/dữ liệu cũ) → coi là tiếng Việt;
 * - object `{ vi, en }` trong JSONB `content` (CMS);
 * - chuỗi JSON `'{"vi":…,"en":…}'` khi object song ngữ được ghi vào cột varchar/text
 *   (hotspot `label`/`body`) — driver pg serialize object bằng JSON.stringify.
 */
export function resolveBilingual(value: unknown): BilingualValue {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && ('vi' in parsed || 'en' in parsed)) {
          return fromObject(parsed as Record<string, unknown>);
        }
      } catch {
        // Không phải JSON hợp lệ: là văn bản thường bắt đầu bằng "{".
      }
    }
    return { vi: textOrNull(value), en: null };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return fromObject(value as Record<string, unknown>);
  }
  return { vi: null, en: null };
}

/** Văn bản hiển thị mặc định: tiếng Việt, thiếu thì tiếng Anh. */
export function primaryText(value: BilingualValue): string | null {
  return value.vi ?? value.en;
}
