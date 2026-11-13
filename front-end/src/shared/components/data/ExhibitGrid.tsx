import { Button, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { RoomDetail } from '@/validations/roomSchema';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import classes from './ExhibitGrid.module.css';

export function ExhibitGrid({ exhibits, roomSlug, onReport, renderActions }: {
  exhibits: readonly RoomDetail['exhibits'][number][];
  roomSlug: string;
  onReport?: (exhibit: RoomDetail['exhibits'][number]) => void;
  renderActions?: (exhibit: RoomDetail['exhibits'][number]) => ReactNode;
}) {
  const { t } = usePublicLocale();
  return (
    <ul className={classes.grid} aria-label={t('ui.collection.grid-aria', 'Hiện vật trong bộ sưu tập')}>
      {exhibits.map((exhibit, index) => (
        <li key={exhibit.id} className={classes.card}>
          <div className={classes.media}>
            <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: exhibit.image.altText.vi || exhibit.name } : null}
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
      ))}
    </ul>
  );
}
