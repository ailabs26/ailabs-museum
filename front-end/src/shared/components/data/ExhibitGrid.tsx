import type { ReactNode } from 'react';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { RoomDetail } from '@/validations/roomSchema';
import { ExhibitCard } from './ExhibitCard';
import classes from './ExhibitGrid.module.css';

export function ExhibitGrid({ exhibits, roomSlug, onReport, renderActions }: {
  exhibits: readonly RoomDetail['exhibits'][number][];
  roomSlug: string;
  onReport?: (exhibit: RoomDetail['exhibits'][number]) => void;
  renderActions?: (exhibit: RoomDetail['exhibits'][number]) => ReactNode;
}) {
  const { t } = usePublicLocale();
  return (
    <div className={classes.container}>
      <ul className={classes.grid} aria-label={t('ui.collection.grid-aria', 'Hiện vật trong bộ sưu tập')}>
        {exhibits.map((exhibit, index) => (
          <ExhibitCard key={exhibit.id} exhibit={exhibit} roomSlug={roomSlug} index={index}
            onReport={onReport} renderActions={renderActions} />
        ))}
      </ul>
    </div>
  );
}
