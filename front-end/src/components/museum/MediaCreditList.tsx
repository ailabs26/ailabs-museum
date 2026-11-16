import { usePublicT } from '@/core/i18n/public-locale';
import type { MediaCredit } from '@/helpers/mediaCredits';

/** Danh sách ghi công media (FR-97): mỗi dòng "Loại media: Tác giả · Nguồn · Giấy phép". */
export function MediaCreditList({ credits, className }: { credits: readonly MediaCredit[]; className?: string }) {
  const t = usePublicT();
  return (
    <ul className={className} style={{ margin: 0, paddingLeft: '1.1rem' }}>
      {credits.map((credit) => {
        const parts = [
          credit.author && t('ui.credits.author', 'Tác giả: {value}', { value: credit.author }),
          credit.source && t('ui.credits.source', 'Nguồn: {value}', { value: credit.source }),
          credit.license && t('ui.credits.license', 'Giấy phép: {value}', { value: credit.license }),
        ].filter(Boolean);
        return (
          <li key={credit.label}>
            <strong>{credit.key ? t(credit.key, credit.label) : credit.label}:</strong> {parts.join(' · ')}
          </li>
        );
      })}
    </ul>
  );
}
