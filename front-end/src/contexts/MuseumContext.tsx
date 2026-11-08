import { createContext, useMemo, useReducer, type ReactNode } from 'react';
import type { RoomDetail } from '@/validations/roomSchema';
import { buildGuidedTourSteps } from '@/helpers/buildGuidedTourSteps';
import { selectGuidedTour } from '@/helpers/guidedTourSelectors';
import { INITIAL_GUIDED_TOUR_STATE } from '@/interfaces/guidedTour';
import { museumReducer } from '@/reducers/museumReducer';

export type MuseumContextValue = ReturnType<typeof selectGuidedTour> & {
  start: (room: RoomDetail, initialExhibitId?: string) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  goTo: (exhibitId: string) => void;
  exit: () => void;
  reconcileRoom: (room: RoomDetail) => void;
  invalidateRoom: (roomId: string) => void;
};

export const MuseumContext = createContext<MuseumContextValue | null>(null);

export function MuseumProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(museumReducer, INITIAL_GUIDED_TOUR_STATE);
  const value = useMemo<MuseumContextValue>(() => ({
    ...selectGuidedTour(state),
    start: (room, initialExhibitId) => dispatch({
      type: 'START', roomId: room.id, roomSlug: room.slug,
      steps: buildGuidedTourSteps(room), initialExhibitId,
    }),
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    next: () => dispatch({ type: 'NEXT' }),
    previous: () => dispatch({ type: 'PREVIOUS' }),
    goTo: (exhibitId) => dispatch({ type: 'GO_TO', exhibitId }),
    exit: () => dispatch({ type: 'EXIT' }),
    reconcileRoom: (room) => dispatch({
      type: 'RECONCILE_ROOM', roomId: room.id, roomSlug: room.slug, steps: buildGuidedTourSteps(room),
    }),
    invalidateRoom: (roomId) => dispatch({ type: 'INVALIDATE_ROOM', roomId }),
  }), [state]);

  return <MuseumContext.Provider value={value}>{children}</MuseumContext.Provider>;
}
