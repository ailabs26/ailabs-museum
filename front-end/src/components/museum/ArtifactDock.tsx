import type { MuseumDisplay } from '@/interfaces/museumScene';
import classes from './ArtifactDock.module.css';
import { usePublicT } from '@/core/i18n/public-locale';

/** Selection focuses through the camera owner; reselecting issues a fresh command. */
export function ArtifactDock({ displays, selectedId, onSelect, onFocus }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null;
  onSelect: (id: string) => void;
  onFocus: () => void;
}) {
  const t = usePublicT();
  const items = displays.filter((d) => !d.isOutsideRoom);
  if (items.length === 0) return null;

  return (
    <div className={classes.dockWrap}>
      <ul className={classes.dock} role="group" aria-label={t('ui.dock.aria', 'Chọn nhanh hiện vật')}>
        {items.map((d, i) => (
          <li key={d.id} className={classes.item}>
            <button type="button"
              className={`${classes.btn} ${d.id === selectedId ? classes.btnActive : ''}`}
              aria-label={t('ui.dock.go-to', 'Lia camera tới {name}', { name: d.title })} aria-pressed={d.id === selectedId}
              onClick={() => { onSelect(d.id); if (d.id === selectedId) onFocus(); }}>
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
