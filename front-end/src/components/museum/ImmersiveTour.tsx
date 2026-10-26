import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, FocusTrap } from '@mantine/core';
import classes from './ImmersiveTour.module.css';

export function ImmersiveTour({ containerRef, roomName, onClose, onEscape, hasModal, children }: {
  containerRef: RefObject<HTMLDivElement>; roomName: string; onClose: () => void;
  onEscape: () => void; hasModal: boolean; children: ReactNode;
}) {
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
        aria-label="Tham quan bảo tàng" tabIndex={-1} onKeyDown={event => {
          if (event.key !== 'Escape' || event.defaultPrevented || hasModal) return;
          event.preventDefault(); event.stopPropagation(); onEscape();
        }}>
        <header className={classes.header}>
          <div className={classes.identity}><span>AURA MUSEUM / KHÔNG GIAN DI SẢN</span><h2>{roomName}</h2></div>
          <Button variant="default" onClick={onClose} aria-label="Thoát tham quan">Thoát tham quan <span aria-hidden="true"> ×</span></Button>
        </header>
        {children}
      </div>
    </FocusTrap>, document.body,
  );
}
