import { MUSEUM_ROOM_SIZE } from '@/interfaces/museumScene';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import classes from './SpatialMinimap.module.css';
import { usePublicT } from '@/core/i18n/public-locale';
import { resolveGalleryLayout } from '@/helpers/gallerySlots';

const PAD = 6;
const VB_W = 100;
const VB_H = Math.round((MUSEUM_ROOM_SIZE.depth / MUSEUM_ROOM_SIZE.width) * VB_W);

/** Chuyển toạ độ mét (x, z) của hiện vật sang hệ SVG của sơ đồ mặt bằng. */
function toPlan(x: number, z: number) {
  const nx = (x + MUSEUM_ROOM_SIZE.width / 2) / MUSEUM_ROOM_SIZE.width;
  const nz = (z + MUSEUM_ROOM_SIZE.depth / 2) / MUSEUM_ROOM_SIZE.depth;
  return {
    cx: PAD + Math.min(1, Math.max(0, nx)) * (VB_W - PAD * 2),
    cy: PAD + Math.min(1, Math.max(0, nz)) * (VB_H - PAD * 2),
  };
}

/**
 * Mini-map 2D (radar) ở góc màn hình: sơ đồ mặt bằng phòng + chấm sáng từng hiện vật,
 * chấm được chọn phát hào quang. Click vào chấm để chọn hiện vật đó.
 */
export function SpatialMinimap({ displays, selectedId, onSelect }: {
  displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const t = usePublicT();
  const inRoom = displays.filter((d) => !d.isOutsideRoom);
  const layout = resolveGalleryLayout(displays);
  // Bục trống chỉ là mốc không gian: không có tên, không bấm được, không tính vào số hiện vật.
  const emptySlots = layout.mode === 'slotted' ? layout.slots.filter((item) => !item.exhibit).map((item) => item.slot) : [];
  if (inRoom.length === 0 && emptySlots.length === 0) return null;

  return (
    <div className={classes.map} role="group" aria-label={t('ui.minimap.aria', 'Sơ đồ mặt bằng phòng trưng bày')}>
      <p className={classes.caption}>{t('ui.minimap.caption', 'Sơ đồ phòng')}</p>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={classes.svg} aria-label={t('ui.minimap.svg-aria', 'Sơ đồ {count} hiện vật trong phòng', { count: inRoom.length })}>
        <rect x="2" y="2" width={VB_W - 4} height={VB_H - 4} rx="6" className={classes.room} />
        {emptySlots.map((slot) => {
          const { cx, cy } = toPlan(slot.position[0], slot.position[2]);
          return <circle key={slot.id} cx={cx} cy={cy} r={slot.plinthKind === 'hero' ? 3.4 : 2.4} className={classes.emptySlot} aria-hidden="true" />;
        })}
        {inRoom.map((d) => {
          const { cx, cy } = toPlan(d.position[0], d.position[2]);
          const active = d.id === selectedId;
          return (
            <g key={d.id} className={active ? classes.dotActive : classes.dot} onClick={() => onSelect(d.id)}
              role="button" tabIndex={0} aria-label={t('ui.minimap.go-to', 'Đi tới {name}', { name: d.title })} aria-pressed={active}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.id); } }}>
              <circle cx={cx} cy={cy} r="12" className={classes.hitArea} />
              {active && <circle cx={cx} cy={cy} r="7" className={classes.halo} />}
              <circle cx={cx} cy={cy} r={active ? 3.4 : 2.4} />
              <title>{d.title}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
