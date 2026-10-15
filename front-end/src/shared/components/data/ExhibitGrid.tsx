import { Title } from '@mantine/core';
import type { RoomDetail } from '@/validations/roomSchema';
import { ExhibitPreview } from './ExhibitPreview';
import classes from './ExhibitGrid.module.css';

export function ExhibitGrid({ exhibits }: { exhibits: readonly RoomDetail['exhibits'][number][] }) {
  return (
    <ul className={classes.grid} aria-label="Hiện vật trong bộ sưu tập">
      {exhibits.map((exhibit, index) => (
        <li key={exhibit.id} className={classes.card}>
          <ExhibitPreview shape={exhibit.placeholderShape} color={exhibit.placeholderColor} className={classes.preview} />
          <div className={classes.cardBody}>
            <p className={classes.number}>Hiện vật {String(index + 1).padStart(2, '0')}</p>
            <Title order={3} className={classes.exhibitTitle}>{exhibit.name}</Title>
            <p className={classes.exhibitDescription}>{exhibit.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
