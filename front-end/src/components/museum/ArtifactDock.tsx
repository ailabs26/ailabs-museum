import type { MuseumDisplay } from '@/interfaces/museumScene';
import classes from './ArtifactDock.module.css';

/** CMS-ordered exhibition index; selecting already triggers the camera owner. */
export function ArtifactDock({ displays, selectedId, onSelect }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const items = displays.filter((d) => !d.isOutsideRoom);
  if (items.length === 0) return null;

  return (
    <div className={classes.dockWrap}>
      <ul className={classes.dock} role="group" aria-label="Chọn nhanh hiện vật">
        {items.map((d, i) => (
          <li key={d.id} className={classes.item}>
            <button type="button"
              className={`${classes.btn} ${d.id === selectedId ? classes.btnActive : ''}`}
              aria-label={`Lia camera tới ${d.title}`} aria-pressed={d.id === selectedId}
              onClick={() => onSelect(d.id)}>
              <span className={classes.num}>{String(i + 1).padStart(2, '0')}</span>
              <span className={classes.name}>{d.title}</span>
            </button>
            <span className={classes.tip}>{d.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
