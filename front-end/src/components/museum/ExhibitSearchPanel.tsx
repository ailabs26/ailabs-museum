import { useEffect, useId, useRef, useState } from 'react';
import { ActionIcon, Button, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import type { ExhibitSearchBinding } from '@/hooks/useExhibitSearchNavigation';
import classes from './ExhibitSearchPanel.module.css';

/** Normal list/buttons deliberately avoid incomplete combobox keyboard semantics. */
export function ExhibitSearchPanel({ query, onQueryChange, results, roomSlug, navigation, activeHotspotId }: {
  query: string; onQueryChange: (query: string) => void; results: readonly MuseumDisplay[];
  roomSlug: string; navigation: ExhibitSearchBinding;
  activeHotspotId?: string;
}) {
  const { locale, t } = usePublicLocale();
  const text = (key: string, vi: string, en: string, params?: Record<string, string | number>) => t(`ui.room-search.${key}`, locale === 'vi' ? vi : en, params);
  const [isOpen, setIsOpen] = useState(false);
  const [limit, setLimit] = useState(6);
  const opener = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const id = useId();
  const close = () => { setIsOpen(false); opener.current?.focus(); };
  useEffect(() => { setLimit(6); }, [query, results]);
  useEffect(() => { if (isOpen) input.current?.focus({ preventScroll: true }); }, [isOpen]);
  useEffect(() => { if (activeHotspotId) setIsOpen(false); }, [activeHotspotId]);
  useEffect(() => {
    if (!isOpen) return;
    const host = opener.current?.closest<HTMLElement>('[data-immersive-tour]');
    if (!host) return;
    // Handle Escape anywhere in the room before ImmersiveTour's document listener,
    // while preserving the original event path of a closing report modal.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.composedPath().some(node =>
        node instanceof HTMLElement && node !== host && node.getAttribute('role') === 'dialog' && node.getAttribute('aria-modal') === 'true')) return;
      event.preventDefault(); event.stopPropagation(); setIsOpen(false); opener.current?.focus();
    };
    host.addEventListener('keydown', escape);
    return () => host.removeEventListener('keydown', escape);
  }, [isOpen]);
  useEffect(() => {
    if (navigation.phase === 'arrived') {
      setIsOpen(false);
      opener.current?.focus();
    }
  }, [navigation.phase]);
  const phaseText = navigation.phase === 'moving' ? text('moving', 'Đang đi tới hiện vật…', 'Moving to exhibit…')
    : navigation.phase === 'arrived' ? text('arrived', 'Đã đến hiện vật.', 'Arrived at exhibit.')
      : navigation.phase === 'blocked' ? text('blocked', 'Không có đường đi an toàn. Bạn có thể đọc chi tiết 2D.', 'No safe route. You can read the 2D details.')
        : navigation.phase === 'cancelled' ? text('cancelled', 'Đã dừng điều hướng.', 'Navigation stopped.') : '';
  return <section className={classes.panel} aria-label={text('title', 'Tìm trong phòng', 'Search this room')}
    data-exhibit-search data-search-open={isOpen} data-search-phase={navigation.phase}>
    <Button ref={opener} variant="default" fullWidth leftSection={<IconSearch size={18} aria-hidden="true" />}
      aria-expanded={isOpen} aria-controls={id} onClick={() => {
        if (isOpen) close(); else setIsOpen(true);
      }}>{text('title', 'Tìm trong phòng', 'Search this room')}</Button>
    {isOpen && <div id={id} className={classes.content}>
      <TextInput ref={input} label={text('input', 'Tìm hiện vật trong phòng', 'Find an exhibit in this room')}
        placeholder={text('placeholder', 'Tên hoặc từ khóa…', 'Name or keyword…')} value={query}
        leftSection={<IconSearch size={16} aria-hidden="true" />} onChange={event => onQueryChange(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            const first = results.find(display => !display.isOutsideRoom);
            if (first) navigation.onNavigate(first.id);
          }
        }} rightSection={query ? <ActionIcon variant="subtle" color="dark" aria-label={text('clear', 'Xóa tìm kiếm', 'Clear search')}
          onClick={() => { onQueryChange(''); input.current?.focus(); }}><IconX size={16} aria-hidden="true" /></ActionIcon> : undefined} />
      <p className={classes.count} role="status">{query.trim()
        ? results.length ? text('count', '{count} hiện vật khớp', '{count} matching exhibits', { count: results.length })
          : text('empty', 'Không tìm thấy hiện vật. Hãy thử từ khóa khác.', 'No exhibits found. Try another keyword.')
        : text('all', '{count} hiện vật trong phòng', '{count} exhibits in this room', { count: results.length })}</p>
      <ul className={classes.results} aria-label={text('results', 'Kết quả tìm kiếm', 'Search results')}>
        {results.slice(0, limit).map(display => <li key={display.id}>
          <h3>{display.title}</h3>
          {display.description && <p className={classes.description}>{display.description}</p>}
          <span className={classes.availability}>{display.isOutsideRoom
            ? text('outside', 'Chỉ xem chi tiết 2D', '2D details only') : text('available', 'Có trong phòng 3D', 'In the 3D room')}</span>
          <Button fullWidth size="sm" color="teal.9" disabled={display.isOutsideRoom} onClick={() => navigation.onNavigate(display.id)}>
            {text('go', 'Đi tới hiện vật', 'Go to exhibit')}</Button>
          <Link to={`/collection/${encodeURIComponent(roomSlug)}/exhibits/${encodeURIComponent(display.id)}`}>
            {text('read', 'Đọc chi tiết 2D', 'Read 2D details')}</Link>
        </li>)}
      </ul>
      {results.length > limit && <Button fullWidth variant="default" onClick={() => setLimit(value => value + 6)}>{text('more', 'Xem thêm kết quả', 'Show more results')}</Button>}
    </div>}
    {phaseText && <p className={classes.status} role="status">{phaseText}</p>}
    {navigation.phase === 'moving' && <Button variant="subtle" color="dark" onClick={navigation.onCancel}>{text('stop', 'Dừng điều hướng', 'Stop navigation')}</Button>}
  </section>;
}
