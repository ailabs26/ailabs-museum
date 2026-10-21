import type { MediaCredit } from '@/helpers/mediaCredits';

/** Danh sách ghi công media (FR-97): mỗi dòng "Loại media: Tác giả · Nguồn · Giấy phép". */
export function MediaCreditList({ credits, className }: { credits: readonly MediaCredit[]; className?: string }) {
  return (
    <ul className={className} style={{ margin: 0, paddingLeft: '1.1rem' }}>
      {credits.map((credit) => {
        const parts = [
          credit.author && `Tác giả: ${credit.author}`,
          credit.source && `Nguồn: ${credit.source}`,
          credit.license && `Giấy phép: ${credit.license}`,
        ].filter(Boolean);
        return (
          <li key={credit.label}>
            <strong>{credit.label}:</strong> {parts.join(' · ')}
          </li>
        );
      })}
    </ul>
  );
}
