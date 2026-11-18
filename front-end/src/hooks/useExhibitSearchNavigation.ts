import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { MuseumDisplay } from '@/interfaces/museumScene';
import { exhibitSearchNavigationReducer, INITIAL_EXHIBIT_SEARCH_NAVIGATION, type ExhibitSearchRequest, type ExhibitSearchPhase } from '@/reducers/exhibitSearchNavigationReducer';
export type { ExhibitSearchRequest } from '@/reducers/exhibitSearchNavigationReducer';

export interface ExhibitSearchBinding {
  request: ExhibitSearchRequest | null;
  targetId?: string;
  phase: ExhibitSearchPhase;
  isCurrent: (request: ExhibitSearchRequest) => boolean;
  onResult: (request: ExhibitSearchRequest, outcome: 'arrived' | 'blocked') => void;
  onCancel: () => void;
  onReady: (ready: boolean) => void;
  onNavigate: (id: string) => void;
}

/** Intent lifecycle only. All transforms and path sampling stay in MuseumControls. */
export function useExhibitSearchNavigation(roomId: string | undefined, displays: readonly MuseumDisplay[], isOpen: boolean,
  onArrive: (id: string) => void) {
  const [state, dispatch] = useReducer(exhibitSearchNavigationReducer, INITIAL_EXHIBIT_SEARCH_NAVIGATION);
  const sequence = useRef(0);
  const ready = useRef(false);
  const current = useRef<{ request: ExhibitSearchRequest; displays: readonly MuseumDisplay[]; roomId: string } | null>(null);
  const latest = useRef({ roomId, displays, isOpen, onArrive }); latest.current = { roomId, displays, isOpen, onArrive };
  const cancel = useCallback(() => {
    current.current = null;
    dispatch({ type: 'cancel' });
  }, []);
  const isCurrent = useCallback((request: ExhibitSearchRequest) => {
    const scope = current.current, live = latest.current;
    return !!scope && scope.request === request && ready.current && live.isOpen
      && scope.roomId === live.roomId && scope.displays === live.displays;
  }, []);
  const navigate = useCallback((exhibitId: string) => {
    const scope = latest.current;
    if (!scope.isOpen || !ready.current || !scope.roomId || !scope.displays.some(display => display.id === exhibitId && !display.isOutsideRoom)) return;
    const request = { exhibitId, requestId: ++sequence.current, issuedAt: performance.now() };
    current.current = { request, displays: scope.displays, roomId: scope.roomId };
    dispatch({ type: 'navigate', request });
  }, []);
  const onResult = useCallback((request: ExhibitSearchRequest, outcome: 'arrived' | 'blocked') => {
    if (!isCurrent(request)) return;
    current.current = null;
    dispatch({ type: 'result', request, outcome });
    if (outcome === 'arrived') latest.current.onArrive(request.exhibitId);
  }, [isCurrent]);
  const onReady = useCallback((value: boolean) => { ready.current = value; if (!value) cancel(); }, [cancel]);
  useEffect(() => { cancel(); }, [roomId, displays, isOpen, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    const leave = () => cancel();
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leave); window.addEventListener('popstate', leave);
    return () => { current.current = null; document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave); window.removeEventListener('popstate', leave); };
  }, [cancel]);
  const binding = { request: state.phase === 'moving' ? state.request : null,
    targetId: state.phase === 'moving' || state.phase === 'arrived' ? state.request?.exhibitId : undefined,
    phase: state.phase, isCurrent, onResult, onCancel: cancel, onReady, onNavigate: navigate } satisfies ExhibitSearchBinding;
  return { binding, navigate, cancel };
}
