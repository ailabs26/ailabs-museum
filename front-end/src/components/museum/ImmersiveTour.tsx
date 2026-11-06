import { useEffect, useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, FocusTrap } from '@mantine/core';
import { LanguageSelect } from '@/shared/components/layout/LanguageSelect';
import type { Translator } from '@/core/i18n/public-locale';
import classes from './ImmersiveTour.module.css';

export function ImmersiveTour({ containerRef, roomName, onClose, onEscape, hasModal, children, translate }: {
  containerRef: RefObject<HTMLDivElement>; roomName: string; onClose: () => void;
  onEscape: () => void; hasModal: boolean; children: ReactNode; translate: Translator;
}) {
  const t = translate;
  useEffect(() => {
    // Removing a focused canvas/XR button can temporarily leave focus on body.
    // Keep Escape owned by the active tour even during loading and recovery.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || hasModal) return;
      // Mantine may close/unmount a modal in the capture phase. Its original
      // event path still owns this Escape even after React updates hasModal.
      if (event.composedPath().some(node => node instanceof HTMLElement && node !== containerRef.current
        && node.getAttribute('role') === 'dialog' && node.getAttribute('aria-modal') === 'true')) return;
      event.preventDefault(); event.stopPropagation(); onEscape();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onEscape, hasModal, containerRef]);
  useLayoutEffect(() => {
    const host = containerRef.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const siblings = [...document.body.children].filter((item): item is HTMLElement => item instanceof HTMLElement && item !== host);
    const inert = siblings.map(item => item.inert);
    siblings.forEach(item => { item.inert = true; });
    document.body.style.overflow = 'hidden';
    return () => {
      siblings.forEach((item, index) => { item.inert = inert[index]; });
      document.body.style.overflow = bodyOverflow;
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [containerRef]);
  return createPortal(
    <FocusTrap active={!hasModal} innerRef={containerRef}>
      <div className={classes.immersive} data-immersive-tour="true" role="dialog" aria-modal="true"
        aria-label={t('ui.tour.dialog.label', 'Tham quan bảo tàng')} tabIndex={-1}>
        <header className={classes.header}>
          <div className={classes.identity}><span>{t('ui.tour.dialog.brand', 'AURA MUSEUM / KHÔNG GIAN DI SẢN')}</span><h2>{roomName}</h2></div>
          <div className={classes.headerControls}>
            <LanguageSelect style={{ width: 128 }} />
            <Button variant="default" onClick={onClose} aria-label={t('ui.tour.dialog.exit', 'Thoát tham quan')}>
              {t('ui.tour.dialog.exit', 'Thoát tham quan')} <span aria-hidden="true"> ×</span>
            </Button>
          </div>
        </header>
        {children}
      </div>
    </FocusTrap>, document.body,
  );
}
