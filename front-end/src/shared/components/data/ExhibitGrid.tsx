import { Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { RoomDetail } from '@/validations/roomSchema';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import classes from './ExhibitGrid.module.css';

export function ExhibitGrid({ exhibits, roomSlug }: { exhibits: readonly RoomDetail['exhibits'][number][]; roomSlug: string }) {
  return (
    <ul className={classes.grid} aria-label="Hiện vật trong bộ sưu tập">
      {exhibits.map((exhibit, index) => (
        <li key={exhibit.id} className={classes.card}>
          <ExhibitImage image={exhibit.image ? { url: exhibit.image.url, alt: exhibit.image.altText.vi || exhibit.name } : null}
            shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
          <div className={classes.cardBody}>
            <p className={classes.number}>Hiện vật {String(index + 1).padStart(2, '0')}</p>
            <Title order={3} className={classes.exhibitTitle}>{exhibit.name}</Title>
            <p className={classes.exhibitDescription}>{exhibit.description}</p>
            <Link className={classes.detailLink}
              to={`/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(exhibit.id)}`}
              aria-label={`Xem chi tiết ${exhibit.name}`}>Xem chi tiết</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
