import { OPTIONAL_CONTENT_LOCALES, type OptionalContentLocale } from '@/services/translations.service';
import { resolveTranslations, type HotspotFormValue } from './exhibitHotspots';

const FIELDS = ['name', 'description', 'transcript', 'altText'] as const;
export type ExhibitTranslationField = (typeof FIELDS)[number];

/** Bản dịch không bắt buộc trong form hiện vật. */
export type ExhibitTranslations = Record<OptionalContentLocale, Record<ExhibitTranslationField, string>>;

/** `content` của revision → giá trị form; không truyền thì toàn ô trống. */
export function toExhibitTranslations(content: Partial<Record<ExhibitTranslationField, unknown>> = {}): ExhibitTranslations {
  const byField = FIELDS.map((field) => [field, resolveTranslations(content[field])] as const);
  return Object.fromEntries(OPTIONAL_CONTENT_LOCALES.map((locale) => [
    locale,
    Object.fromEntries(byField.map(([field, values]) => [field, values[locale]])),
  ])) as ExhibitTranslations;
}

/** Bản dịch có nội dung của một trường, đã trim: ô trống không gửi lên API. */
export function translatedField(
  translations: ExhibitTranslations,
  field: ExhibitTranslationField,
): Partial<Record<OptionalContentLocale, string>> {
  return Object.fromEntries(OPTIONAL_CONTENT_LOCALES.flatMap((locale) => {
    const value = translations[locale][field].trim();
    return value ? [[locale, value]] : [];
  }));
}

/** Số ô đã dịch của một ngôn ngữ, gồm cả hotspot. */
export function translationProgress(
  translations: ExhibitTranslations,
  hotspots: readonly HotspotFormValue[],
  locale: OptionalContentLocale,
): { done: number; total: number } {
  const values = [
    ...FIELDS.map((field) => translations[locale][field]),
    ...hotspots.flatMap((hotspot) => [hotspot.translations[locale].label, hotspot.translations[locale].body]),
  ];
  return { done: values.filter((value) => value.trim()).length, total: values.length };
}
