import { Title } from '@mantine/core';
import { IconPhotoOff } from '@tabler/icons-react';
import type { RoomDetail } from '@/validations/roomSchema';
import classes from './ExhibitGrid.module.css';

export function ExhibitGrid({ exhibits }: { exhibits: readonly RoomDetail['exhibits'][number][] }) {
  return (
    <ul className={classes.grid} aria-label="Hiện vật trong bộ sưu tập">
      {exhibits.map((exhibit, index) => (
        <li key={exhibit.id} className={classes.card}>
          <div className={classes.noImage}>
            <IconPhotoOff size={28} stroke={1.25} aria-hidden="true" />
            <span>Chưa có ảnh</span>
          </div>
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
