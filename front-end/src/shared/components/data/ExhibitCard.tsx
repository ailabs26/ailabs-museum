import { Button, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { RoomDetail } from '@/validations/roomSchema';
import { localizedAltText } from '@/helpers/localizeExhibit';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import classes from './ExhibitCard.module.css';

type Exhibit = RoomDetail['exhibits'][number];

export function ExhibitCard({ exhibit, roomSlug, index, onReport, renderActions }: {
  exhibit: Exhibit;
  roomSlug: string;
  index: number;
  onReport?: (exhibit: Exhibit) => void;
  renderActions?: (exhibit: Exhibit) => ReactNode;
}) {
  const { locale, t } = usePublicLocale();
  return (
    <li className={classes.card}>
      <div className={classes.media}>
        <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: localizedAltText(exhibit.image.altText, locale, exhibit.name) } : null}
          shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
        <span className={classes.mediaOverlay} aria-hidden="true" />
        <span className={classes.badge}>{t('ui.collection.badge', 'Hiện vật {number}', { number: String(index + 1).padStart(2, '0') })}</span>
      </div>
      <div className={classes.cardBody}>
        <Title order={3} className={classes.exhibitTitle}>{exhibit.name}</Title>
        <p className={classes.exhibitDescription}>{exhibit.description}</p>
        <div className={classes.actions}>
          <Link className={classes.detailLink}
            to={`/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(exhibit.id)}`}
            aria-label={t('ui.collection.details-aria', 'Xem chi tiết {name}', { name: exhibit.name })}>
            {t('ui.collection.details', 'Xem chi tiết')} <IconArrowRight size={16} aria-hidden="true" />
          </Link>
          {onReport && <Button variant="subtle" size="compact-sm" color="gray" onClick={() => onReport(exhibit)}>{t('ui.common.report-content', 'Báo nội dung')}</Button>}
        </div>
        {renderActions && <div className={classes.actions}>{renderActions(exhibit)}</div>}
      </div>
    </li>
  );
}
