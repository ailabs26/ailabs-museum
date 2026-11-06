import type { MediaCredit } from '@/helpers/mediaCredits';

const TYPE_LABELS: Record<string, [key: string, fallback: string]> = {
  'Mô hình 3D': ['ui.media.type.model', 'Mô hình 3D'],
  'Hình ảnh': ['ui.media.type.image', 'Hình ảnh'],
  'Thuyết minh tiếng Việt': ['ui.media.type.narration.vi', 'Thuyết minh tiếng Việt'],
  'Thuyết minh tiếng Anh': ['ui.media.type.narration.en', 'Thuyết minh tiếng Anh'],
  'Phụ đề tiếng Việt': ['ui.media.type.subtitle.vi', 'Phụ đề tiếng Việt'],
  'Phụ đề tiếng Anh': ['ui.media.type.subtitle.en', 'Phụ đề tiếng Anh'],
};

/** Danh sách ghi công media (FR-97): mỗi dòng "Loại media: Tác giả · Nguồn · Giấy phép". */
export function MediaCreditList({ credits, className, translate }: {
  credits: readonly MediaCredit[]; className?: string; translate?: (key: string, fallback: string) => string;
}) {
  const t = translate ?? ((_key: string, fallback: string) => fallback);
  return (
    <ul className={className} style={{ margin: 0, paddingLeft: '1.1rem' }}>
      {credits.map((credit) => {
        const typeLabel = TYPE_LABELS[credit.label];
        const parts = [
          credit.author && `${t('ui.media.credit.author', 'Tác giả')}: ${credit.author}`,
          credit.source && `${t('ui.media.credit.source', 'Nguồn')}: ${credit.source}`,
          credit.license && `${t('ui.media.credit.license', 'Giấy phép')}: ${credit.license}`,
        ].filter(Boolean);
        return (
          <li key={credit.label}>
            <strong>{typeLabel ? t(...typeLabel) : credit.label}:</strong> {parts.join(' · ')}
          </li>
        );
      })}
    </ul>
  );
}
