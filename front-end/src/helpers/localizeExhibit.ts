type LocalizedCopy = { name: string | null; description: string | null };

/**
 * Tên/mô tả hiện vật theo ngôn ngữ, lấy từ revision đã xuất bản (đã qua kiểm duyệt). Revision chỉ có vi/en; ngôn ngữ
 * khác hoặc bản dịch trống thì giữ nội dung gốc.
 */
export function localizeExhibit<T extends { name: string; description: string; i18n?: { vi: LocalizedCopy; en: LocalizedCopy } }>(
  exhibit: T, locale: string,
): T {
  const copy = locale === 'en' ? exhibit.i18n?.en : undefined;
  if (!copy) return exhibit;
  return { ...exhibit, name: copy.name || exhibit.name, description: copy.description || exhibit.description };
}
