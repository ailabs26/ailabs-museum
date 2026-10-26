import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/** One presentation owner; fullscreen rejection never prevents the fixed overlay. */
export function useImmersiveTour() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(false);
  const isXrPresentingRef = useRef(false);
  const restorationRef = useRef<{ x: number; y: number; focus: HTMLElement | null }>();
  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    if (document.fullscreenElement === containerRef.current) void document.exitFullscreen().catch(() => {});
  }, []);
  const open = useCallback(() => {
    restorationRef.current = { x: window.scrollX, y: window.scrollY, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    isOpenRef.current = true;
    isXrPresentingRef.current = false;
    // Mount the fullscreen element within the original user activation.
    flushSync(() => setIsOpen(true));
    const host = containerRef.current;
    if (!host?.requestFullscreen || document.fullscreenElement) return;
    try {
      void host.requestFullscreen().then(() => {
        if ((!isOpenRef.current || containerRef.current !== host) && document.fullscreenElement === host) {
          void document.exitFullscreen().catch(() => {});
        }
      }).catch(() => { /* The viewport overlay remains usable. */ });
    } catch { /* Older implementations can throw synchronously. */ }
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const host = containerRef.current;
    let hasNativeFullscreen = document.fullscreenElement === host;
    const change = () => {
      if (document.fullscreenElement === host) hasNativeFullscreen = true;
      else if (hasNativeFullscreen) {
        hasNativeFullscreen = false;
        if (!isXrPresentingRef.current) close();
      }
    };
    document.addEventListener('fullscreenchange', change);
    return () => {
      isOpenRef.current = false;
      document.removeEventListener('fullscreenchange', change);
      if (document.fullscreenElement === host) void document.exitFullscreen().catch(() => {});
      const previous = restorationRef.current;
      if (previous) {
        window.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' });
        if (previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
      }
    };
  }, [isOpen, close]);
  return { isOpen, containerRef, isXrPresentingRef, open, close };
}
