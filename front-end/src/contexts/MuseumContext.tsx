import { createContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { RoomDetail } from '@/validations/roomSchema';
import { buildGuidedTourSteps } from '@/helpers/buildGuidedTourSteps';
import { GuidedDwellClock } from '@/helpers/guidedDwellClock';
import { selectGuidedTour } from '@/helpers/guidedTourSelectors';
import { INITIAL_GUIDED_TOUR_STATE, type GuidedTourStep } from '@/interfaces/guidedTour';
import { museumReducer } from '@/reducers/museumReducer';

const dwellKey = (step: GuidedTourStep) => `${step.roomId}:${step.exhibitId}`;

export type MuseumContextValue = ReturnType<typeof selectGuidedTour> & {
  roomSlug: string | null;
  start: (room: RoomDetail, initialExhibitId?: string) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  goTo: (exhibitId: string) => void;
  exit: () => void;
  reconcileRoom: (room: RoomDetail) => void;
  invalidateRoom: (roomId: string) => void;
  startDwell: (step: GuidedTourStep, onElapsed: () => void) => void;
  pauseDwell: () => void;
};

export const MuseumContext = createContext<MuseumContextValue | null>(null);

export function MuseumProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(museumReducer, INITIAL_GUIDED_TOUR_STATE);
  const dwell = useRef(new GuidedDwellClock());
  useEffect(() => () => dwell.current.dispose(), []);
  const value = useMemo<MuseumContextValue>(() => ({
    ...selectGuidedTour(state),
    roomSlug: state.session?.roomSlug ?? null,
    start: (room, initialExhibitId) => {
      const steps = buildGuidedTourSteps(room);
      const initialStep = steps.find(step => step.exhibitId === (initialExhibitId ?? steps[0]?.exhibitId));
      if (initialStep) dwell.current.reset(dwellKey(initialStep));
      dispatch({ type: 'START', roomId: room.id, roomSlug: room.slug, steps, initialExhibitId });
    },
    pause: () => { dwell.current.pause(); dispatch({ type: 'PAUSE' }); },
    resume: () => dispatch({ type: 'RESUME' }),
    next: () => {
      const tour = selectGuidedTour(state);
      const nextStep = tour.steps[tour.currentIndex + 1];
      dwell.current.reset(nextStep ? dwellKey(nextStep) : null);
      dispatch({ type: 'NEXT' });
    },
    previous: () => {
      const tour = selectGuidedTour(state);
      const previousStep = tour.steps[tour.currentIndex - 1];
      if (previousStep) dwell.current.reset(dwellKey(previousStep));
      dispatch({ type: 'PREVIOUS' });
    },
    goTo: (exhibitId) => {
      const tour = selectGuidedTour(state);
      const target = tour.steps.find(step => step.exhibitId === exhibitId);
      if (target && target.exhibitId !== tour.currentStep?.exhibitId) dwell.current.reset(dwellKey(target));
      dispatch({ type: 'GO_TO', exhibitId });
    },
    exit: () => { dwell.current.dispose(); dispatch({ type: 'EXIT' }); },
    reconcileRoom: (room) => {
      const tour = selectGuidedTour(state);
      const steps = buildGuidedTourSteps(room);
      if (state.session?.roomId === room.id && !steps.length) dwell.current.dispose();
      else if (state.session?.roomId === room.id && tour.currentStep) {
        const available = new Set(steps.map(step => step.exhibitId));
        const fallbackId = tour.steps.slice(tour.currentIndex + 1).find(step => available.has(step.exhibitId))?.exhibitId
          ?? tour.steps.slice(0, tour.currentIndex).reverse().find(step => available.has(step.exhibitId))?.exhibitId;
        const currentId = available.has(tour.currentStep.exhibitId) ? tour.currentStep.exhibitId : fallbackId;
        const currentStep = steps.find(step => step.exhibitId === currentId);
        if (!currentStep) dwell.current.dispose();
        else if (currentStep.exhibitId !== tour.currentStep.exhibitId) dwell.current.reset(dwellKey(currentStep));
      }
      dispatch({ type: 'RECONCILE_ROOM', roomId: room.id, roomSlug: room.slug, steps });
    },
    invalidateRoom: (roomId) => {
      if (state.session?.roomId === roomId) dwell.current.dispose();
      dispatch({ type: 'INVALIDATE_ROOM', roomId });
    },
    startDwell: (step, onElapsed) => {
      const tour = selectGuidedTour(state);
      if (tour.status === 'running' && tour.currentStep?.roomId === step.roomId
        && tour.currentStep.exhibitId === step.exhibitId) dwell.current.start(dwellKey(step), onElapsed);
    },
    pauseDwell: () => dwell.current.pause(),
  }), [state]);

  return <MuseumContext.Provider value={value}>{children}</MuseumContext.Provider>;
}
