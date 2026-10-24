import type { MuseumDisplay } from '@/interfaces/museumScene';
import classes from './ArtifactDock.module.css';

/**
 * Dock chọn hiện vật kiểu macOS ở đáy khung 3D: dải nút hiện vật phóng to khi rê chuột,
 * click để chọn và tự lia camera tập trung vào hiện vật đó.
 */
export function ArtifactDock({ displays, selectedId, onSelect, onFocus }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null;
  onSelect: (id: string) => void; onFocus: () => void;
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
              style={{ background: d.color }}
              aria-label={`Lia camera tới ${d.title}`} aria-pressed={d.id === selectedId}
              onClick={() => { onSelect(d.id); onFocus(); }}>
              <span className={classes.num}>{String(i + 1).padStart(2, '0')}</span>
            </button>
            <span className={classes.tip}>{d.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
