type LocalizedCopy = { name: string | null; description: string | null; transcript?: string | null };
type HotspotCopy = { label: string | null; body: string | null };

interface LocalizableExhibit {
  name: string;
  description: string;
  i18n?: Partial<Record<string, LocalizedCopy>>;
  hotspots?: readonly { label: string; body: string; i18n?: Partial<Record<string, HotspotCopy>> }[];
}

/**
 * Tên, mô tả, hotspot theo ngôn ngữ, lấy từ revision đã xuất bản (đã qua kiểm duyệt). Bản dịch trống thì giữ nội dung
 * gốc, tức tiếng Việt rồi tiếng Anh.
 */
export function localizeExhibit<T extends LocalizableExhibit>(exhibit: T, locale: string): T {
  const copy = exhibit.i18n?.[locale];
  // Không có gì để thay thì trả đúng object cũ, để memo và cảnh 3D không phải dựng lại.
  if (locale === 'vi' || (!copy && !exhibit.hotspots?.some((hotspot) => hotspot.i18n?.[locale]))) return exhibit;
  const hotspots = exhibit.hotspots?.map((hotspot) => {
    const text = hotspot.i18n?.[locale];
    return text ? { ...hotspot, label: text.label || hotspot.label, body: text.body || hotspot.body } : hotspot;
  });
  return {
    ...exhibit,
    name: copy?.name || exhibit.name,
    description: copy?.description || exhibit.description,
    ...(hotspots ? { hotspots } : {}),
  };
}

/** Thuyết minh theo ngôn ngữ; thiếu thì dùng lời của audio tiếng Việt, rồi bản tiếng Việt. */
export function localizedTranscript(
  exhibit: { transcript?: string | null; i18n?: Partial<Record<string, LocalizedCopy>>; audio?: { vi: { transcript: string | null } | null } | null },
  locale: string,
): string | null {
  return exhibit.i18n?.[locale]?.transcript
    || (exhibit.audio?.vi?.transcript ?? (exhibit.i18n ? exhibit.i18n.vi?.transcript ?? null : exhibit.transcript ?? null));
}

/** Alt text ảnh theo ngôn ngữ; thiếu thì tiếng Việt, rồi tên hiện vật. */
export function localizedAltText(altText: Partial<Record<string, string | null>>, locale: string, fallback: string): string {
  return altText[locale] || altText.vi || fallback;
}

/** Tên hiện vật đã có bản dịch cho ngôn ngữ này chưa; tiếng Việt là ngôn ngữ gốc nên luôn có. */
export function hasTranslation(exhibit: { i18n?: Partial<Record<string, LocalizedCopy>> }, locale: string): boolean {
  return locale === 'vi' || !!exhibit.i18n?.[locale]?.name;
}
