import type { ExhibitDetail, HotspotInput } from '@/services/exhibits.service';
import { OPTIONAL_CONTENT_LOCALES, type OptionalContentLocale } from '@/services/translations.service';

/** Giới hạn khớp cổng gửi duyệt của back-end (§5.2): mỗi ngôn ngữ bắt buộc, tiêu đề ≤ 200, nội dung ≤ 5.000. */
export const HOTSPOT_LABEL_MAX = 200;
export const HOTSPOT_BODY_MAX = 5000;

/** Một hotspot trong form CMS (tọa độ: hệ local của file GLB gốc, mét, Y hướng lên). */
export interface HotspotFormValue {
  labelVi: string;
  labelEn: string;
  bodyVi: string;
  bodyEn: string;
  /** Bản dịch không bắt buộc của tiêu đề và nội dung. */
  translations: HotspotTranslations;
  positionX: number;
  positionY: number;
  positionZ: number;
}

export type HotspotTranslations = Record<OptionalContentLocale, { label: string; body: string }>;

export interface BilingualPair {
  vi: string;
  en: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Văn bản đa ngôn ngữ từ API (hotspot, nội dung revision): object `{ vi, en, ... }`, chuỗi JSON `'{"vi":…}'` (cột
 * varchar/text lưu object đã JSON.stringify) hoặc chuỗi thường (dữ liệu cũ — coi là tiếng Việt).
 */
function localizedRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const isLocalized = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          && ['vi', 'en', ...OPTIONAL_CONTENT_LOCALES].some((locale) => locale in parsed);
        if (isLocalized) return parsed as Record<string, unknown>;
      } catch {
        // Không phải JSON: văn bản thường bắt đầu bằng "{".
      }
    }
    return { vi: value };
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function resolveBilingualText(value: unknown): BilingualPair {
  const record = localizedRecord(value);
  return { vi: text(record.vi), en: text(record.en) };
}

/** Bản dịch không bắt buộc của cùng các dạng dữ liệu, thiếu thì chuỗi rỗng. */
export function resolveTranslations(value: unknown): Record<OptionalContentLocale, string> {
  const record = localizedRecord(value);
  return Object.fromEntries(OPTIONAL_CONTENT_LOCALES.map((locale) => [locale, text(record[locale])])) as Record<OptionalContentLocale, string>;
}

function emptyHotspotTranslations(): HotspotTranslations {
  return Object.fromEntries(OPTIONAL_CONTENT_LOCALES.map((locale) => [locale, { label: '', body: '' }])) as HotspotTranslations;
}

export function emptyHotspot(): HotspotFormValue {
  return { labelVi: '', labelEn: '', bodyVi: '', bodyEn: '', translations: emptyHotspotTranslations(), positionX: 0, positionY: 0, positionZ: 0 };
}

/** Chỉ giữ bản dịch có nội dung, đã trim: ô trống không gửi lên API. */
function filledTranslations(pick: (locale: OptionalContentLocale) => string): Partial<Record<OptionalContentLocale, string>> {
  return Object.fromEntries(OPTIONAL_CONTENT_LOCALES.flatMap((locale) => {
    const value = pick(locale).trim();
    return value ? [[locale, value]] : [];
  }));
}

/** Hotspot của revision đang hiển thị → giá trị form, theo thứ tự hiển thị. */
export function toHotspotFormValues(hotspots: ExhibitDetail['hotspots']): HotspotFormValue[] {
  return [...hotspots]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((hotspot) => {
      const label = resolveBilingualText(hotspot.label);
      const body = resolveBilingualText(hotspot.body);
      const labels = resolveTranslations(hotspot.label);
      const bodies = resolveTranslations(hotspot.body);
      return {
        labelVi: label.vi,
        labelEn: label.en,
        bodyVi: body.vi,
        bodyEn: body.en,
        translations: Object.fromEntries(OPTIONAL_CONTENT_LOCALES.map((locale) => (
          [locale, { label: labels[locale], body: bodies[locale] }]
        ))) as HotspotTranslations,
        positionX: Number(hotspot.position.x) || 0,
        positionY: Number(hotspot.position.y) || 0,
        positionZ: Number(hotspot.position.z) || 0,
      };
    });
}

/** Giá trị form → payload API; back-end thay toàn bộ hotspot của bản nháp bằng danh sách này. */
export function toHotspotPayload(values: readonly HotspotFormValue[]): HotspotInput[] {
  return values.map((value, index) => ({
    label: { vi: value.labelVi.trim(), en: value.labelEn.trim(), ...filledTranslations((locale) => value.translations[locale].label) },
    body: { vi: value.bodyVi.trim(), en: value.bodyEn.trim(), ...filledTranslations((locale) => value.translations[locale].body) },
    positionX: value.positionX,
    positionY: value.positionY,
    positionZ: value.positionZ,
    displayOrder: index + 1,
  }));
}

function required(value: string, max: number, name: string): string | null {
  const length = value.trim().length;
  if (length === 0) return `${name} không được để trống`;
  return length > max ? `${name} tối đa ${max.toLocaleString('vi-VN')} ký tự` : null;
}

/**
 * Lỗi theo field form (`hotspots.<i>.<field>`) — cùng luật với cổng gửi duyệt để biên tập viên
 * sửa ngay khi lưu thay vì đợi lúc Submit Review.
 */
export function validateHotspots(values: readonly HotspotFormValue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  values.forEach((value, index) => {
    const checks: [keyof HotspotFormValue, string | null][] = [
      ['labelVi', required(value.labelVi, HOTSPOT_LABEL_MAX, 'Tiêu đề tiếng Việt')],
      ['labelEn', required(value.labelEn, HOTSPOT_LABEL_MAX, 'Tiêu đề tiếng Anh')],
      ['bodyVi', required(value.bodyVi, HOTSPOT_BODY_MAX, 'Nội dung tiếng Việt')],
      ['bodyEn', required(value.bodyEn, HOTSPOT_BODY_MAX, 'Nội dung tiếng Anh')],
    ];
    for (const axis of ['positionX', 'positionY', 'positionZ'] as const) {
      checks.push([axis, Number.isFinite(value[axis]) ? null : 'Tọa độ phải là số']);
    }
    for (const [field, message] of checks) {
      if (message) errors[`hotspots.${index}.${field}`] = message;
    }
  });
  return errors;
}
